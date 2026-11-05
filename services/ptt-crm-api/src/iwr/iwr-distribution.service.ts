import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdNotificationsRepository } from '../csd/csd-notifications.repository';
import {
  assertCanReceive,
  filterRecipientsForViewer,
  IwrPolicyError,
  replyAllRecipientIds,
} from './iwr-recipient.util';
import { IwrDistributionRepository } from './iwr-distribution.repository';
import { IwrOrgRepository, IwrReportsRepository } from './iwr-reports.repository';
import { IwrPolicyService } from './iwr-policy.service';
import type { IwrActor, IwrCommentRow, IwrDeliveryLogRow, IwrRecipientRow } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrDistributionService {
  constructor(
    private readonly repo: IwrReportsRepository,
    private readonly distRepo: IwrDistributionRepository,
    private readonly org: IwrOrgRepository,
    private readonly policy: IwrPolicyService,
    private readonly notify: CsdNotificationsRepository,
  ) {}

  private mapPolicyError(err: unknown): never {
    if (err instanceof IwrPolicyError) {
      throw new ForbiddenException({ error: err.error });
    }
    throw err;
  }

  private snapshotRecipients(recipients: IwrRecipientRow[]) {
    return {
      to: recipients.filter((r) => r.kind === 'to').map((r) => r.staff_id),
      cc: recipients.filter((r) => r.kind === 'cc').map((r) => r.staff_id),
      bcc: recipients.filter((r) => r.kind === 'bcc').map((r) => r.staff_id),
    };
  }

  private async assertCanView(actor: IwrActor, reportId: string) {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id === actor.staffId) return report;
    if (hasIwrCap(actor, 'manage') || hasIwrCap(actor, 'executive')) return report;
    if (await this.repo.isRecipient(reportId, actor.staffId)) return report;
    throw new ForbiddenException({ error: 'iwr_forbidden' });
  }

  async reply(
    actor: IwrActor,
    id: string,
    input: { body_text: string; mention_staff_ids?: number[] },
  ): Promise<IwrCommentRow> {
    await this.assertCanView(actor, id);
    const body = String(input.body_text ?? '').trim();
    if (body.length < 1) throw new BadRequestException({ error: 'comment_required' });

    const comment = await this.distRepo.insertComment({
      report_id: id,
      section_key: '',
      body_text: body,
      created_by_staff_id: actor.staffId,
    });

    const mentionIds = (input.mention_staff_ids ?? []).map(Number).filter((n) => n > 0);
    if (mentionIds.length) {
      await this.distRepo.insertMentions(id, comment.id, mentionIds);
      for (const staffId of mentionIds) {
        await this.notify.insert({
          staff_id: staffId,
          event_key: 'iwr_mention',
          title_vi: 'Bạn được nhắc trong BC nội bộ',
          body_vi: body.slice(0, 200),
          entity_type: 'iwr_report',
          entity_id: id,
          severity: 'info',
        });
      }
    }

    const report = await this.repo.getReport(id);
    if (report && report.author_staff_id !== actor.staffId) {
      await this.notify.insert({
        staff_id: report.author_staff_id,
        event_key: 'iwr_comment_added',
        title_vi: 'Phản hồi báo cáo nội bộ',
        body_vi: body.slice(0, 200),
        entity_type: 'iwr_report',
        entity_id: id,
        severity: 'info',
      });
    }

    return comment;
  }

  async replyAll(actor: IwrActor, id: string, input: { body_text: string }): Promise<IwrCommentRow> {
    const report = await this.assertCanView(actor, id);
    const recipients = await this.repo.listRecipients(id);
    const visible = filterRecipientsForViewer(actor, report, recipients);
    const mentionIds = replyAllRecipientIds(visible, report.author_staff_id, actor.staffId);

    const comment = await this.reply(actor, id, {
      body_text: input.body_text,
      mention_staff_ids: mentionIds,
    });

    const snap = this.snapshotRecipients(visible);
    const distributionId = await this.distRepo.insertDistribution({
      report_id: id,
      kind: 'reply_all',
      from_staff_id: actor.staffId,
      note_text: input.body_text,
    });
    await this.distRepo.insertDeliveryLog({
      report_id: id,
      distribution_id: distributionId,
      to_snapshot: snap.to,
      cc_snapshot: snap.cc,
      bcc_snapshot: [],
    });

    return comment;
  }

  async forward(
    actor: IwrActor,
    id: string,
    input: { to_staff_ids: number[]; note: string },
  ): Promise<{ distribution_id: string }> {
    const report = await this.assertCanView(actor, id);
    const author = await this.org.getStaff(report.author_staff_id);
    if (!author) throw new ForbiddenException({ error: 'iwr_unresolved_staff' });
    const nodes = await this.org.listActiveStaff();
    const toIds = (input.to_staff_ids ?? []).map(Number).filter((n) => n > 0);
    if (!toIds.length) throw new BadRequestException({ error: 'iwr_recipient_required' });

    const rules = await this.policy.getActiveRules();
    try {
      assertCanReceive({
        actor,
        author,
        nodes,
        toIds,
        ccIds: [],
        bccIds: [],
        policy: rules ?? undefined,
        reportSensitivity: report.sensitivity,
      });
    } catch (err) {
      this.mapPolicyError(err);
    }

    const distributionId = await this.distRepo.insertDistribution({
      report_id: id,
      kind: 'forward',
      from_staff_id: actor.staffId,
      note_text: input.note,
    });
    await this.distRepo.insertDeliveryLog({
      report_id: id,
      distribution_id: distributionId,
      to_snapshot: toIds,
      cc_snapshot: [],
      bcc_snapshot: [],
    });

    for (const staffId of toIds) {
      await this.notify.insert({
        staff_id: staffId,
        event_key: 'iwr_report_forwarded',
        title_vi: 'BC nội bộ được chuyển tiếp',
        body_vi: String(input.note ?? '').slice(0, 200) || report.title,
        entity_type: 'iwr_report',
        entity_id: id,
        severity: 'info',
      });
    }

    return { distribution_id: distributionId };
  }

  async listDeliveryLogs(actor: IwrActor, reportId: string): Promise<{ items: IwrDeliveryLogRow[] }> {
    await this.assertCanView(actor, reportId);
    const items = await this.distRepo.listDeliveryLogs(reportId);
    return { items };
  }
}
