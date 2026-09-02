import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canTransitionReport } from './csd-report-workflow.util';
import { applyTicketRollup, type CsdTicketRollup } from './csd-report-rollup.util';
import { bumpReportVersion } from './csd-report-version.util';
import { normalizeSection } from './csd-report-blocks';
import {
  labelForSection,
  renderCsdReportPdf,
  renderCsdReportXlsx,
} from './csd-report-export.util';
import { CsdEmailService } from './csd-email.service';
import { CsdNotificationsRepository } from './csd-notifications.repository';
import { CsdReportsRepository } from './csd-reports.repository';
import { CsdTicketsRepository } from './csd-tickets.repository';
import {
  CreateCsdReportInput,
  CsdActor,
  CsdAttachmentRow,
  CsdReportDetail,
  CsdReportListQuery,
  CsdReportRow,
  CsdReportSendLogRow,
  CsdReportStatus,
  CsdTicketRow,
  SendCsdReportInput,
  SnapshotCsdReportInput,
  TransitionCsdReportInput,
} from './csd.types';

const FILE_MAX_BYTES = 104857600;

function safeFileName(name: string): string {
  return String(name || 'file')
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
}

function fileDir(): string {
  return process.env.PTT_CSD_FILE_DIR || join(process.cwd(), 'data/csd-files');
}

function asRollupItem(row: CsdTicketRow): CsdTicketRollup['closed'][number] {
  return { id: row.id, code: row.code, title: row.title };
}

function classifyTickets(rows: CsdTicketRow[]): CsdTicketRollup {
  return {
    closed: rows.filter((t) => t.status === 'closed' || t.status === 'resolved').map(asRollupItem),
    breached: rows.filter((t) => t.sla_status === 'breached').map(asRollupItem),
    out_of_scope: rows.filter((t) => t.scope_status === 'out_of_scope').map(asRollupItem),
  };
}

function emptySections(keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, { body: '' }]));
}

function hasCsdManage(actor: CsdActor): boolean {
  return actor.caps.some((c) => c.section === 'csd' && c.action === 'manage');
}

@Injectable()
export class CsdReportsService {
  constructor(
    private readonly repo: CsdReportsRepository,
    private readonly tickets: CsdTicketsRepository,
    private readonly email: CsdEmailService,
    private readonly notify: CsdNotificationsRepository,
  ) {}

  async createReport(actor: CsdActor, input: CreateCsdReportInput): Promise<CsdReportRow> {
    const template = await this.repo.getTemplateByCode(input.template_code);
    if (!template) throw new NotFoundException({ error: 'csd_report_template_not_found' });

    const periodStart = String(input.period_start ?? '').slice(0, 10);
    const periodEnd = String(input.period_end ?? '').slice(0, 10);
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      throw new BadRequestException({ error: 'invalid_period' });
    }

    const title =
      String(input.title ?? '').trim() ||
      `${template.name_vi} ${periodStart} — ${periodEnd}`;

    return this.repo.insertReport({
      template_id: template.id,
      title,
      client_account_id: input.client_account_id ?? null,
      period_start: periodStart,
      period_end: periodEnd,
      owner_staff_id: actor.staffId,
      created_by_staff_id: actor.staffId,
      sections_json: emptySections(template.sections_json),
    });
  }

  async get(_actor: CsdActor, id: string): Promise<CsdReportRow> {
    const report = await this.repo.getReport(id);
    if (!report) throw new NotFoundException({ error: 'csd_report_not_found' });
    return report;
  }

  async list(_actor: CsdActor, query: CsdReportListQuery): Promise<{ items: CsdReportRow[] }> {
    const items = await this.repo.listReports(query);
    return { items };
  }

  async getDetail(actor: CsdActor, id: string): Promise<CsdReportDetail> {
    const report = await this.get(actor, id);
    const [current, versions, send_logs, template] = await Promise.all([
      this.repo.getCurrentVersion(id),
      this.repo.listVersions(id),
      this.repo.listSendLogs(id),
      report.template_code ? this.repo.getTemplateByCode(report.template_code) : Promise.resolve(null),
    ]);
    return {
      ...report,
      sections_json: current?.sections_json ?? {},
      versions,
      send_logs,
      template_name_vi: template?.name_vi ?? null,
      template_sections: template?.sections_json ?? [],
    };
  }

  private async exportDetail(actor: CsdActor, id: string) {
    const detail = await this.getDetail(actor, id);
    const keys =
      detail.template_sections.length > 0
        ? detail.template_sections
        : Object.keys(detail.sections_json ?? {});
    return {
      title: detail.title,
      version: detail.current_version,
      period_start: detail.period_start,
      period_end: detail.period_end,
      client_label: detail.client_account_id ?? '',
      sections: keys.map((key) => ({
        key,
        label: labelForSection(key),
        section: normalizeSection(detail.sections_json?.[key]),
      })),
      code: detail.template_code || detail.id,
    };
  }

  private exportFilename(code: string, version: string, ext: 'pdf' | 'xlsx'): string {
    const safeCode = String(code || 'report').replace(/[^\w.-]+/g, '_');
    const safeVer = String(version || 'v1').replace(/[^\w.-]+/g, '_');
    return `PTT-${safeCode}-${safeVer}.${ext}`;
  }

  async exportPdf(actor: CsdActor, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.exportDetail(actor, id);
    return {
      buffer: await renderCsdReportPdf(detail),
      filename: this.exportFilename(detail.code, detail.version, 'pdf'),
    };
  }

  async exportXlsx(actor: CsdActor, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.exportDetail(actor, id);
    return {
      buffer: await renderCsdReportXlsx(detail),
      filename: this.exportFilename(detail.code, detail.version, 'xlsx'),
    };
  }

  async transition(
    actor: CsdActor,
    id: string,
    input: TransitionCsdReportInput,
  ): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    const to = input.to;
    if (to === 'sent' || to === 'viewed' || to === 'acknowledged') {
      throw new ConflictException({ error: 'use_send_endpoint' });
    }
    if (to === 'changes_requested' && String(input.comment ?? '').trim().length < 3) {
      throw new BadRequestException({ error: 'comment_required' });
    }

    const bypass = hasCsdManage(actor);
    const needsManage =
      (to === 'approved' && report.requires_approval) || to === 'changes_requested';
    if (needsManage && !bypass) {
      throw new ForbiddenException({ error: 'csd_manage_required' });
    }
    if (!canTransitionReport(report.status, to, { requires_approval: report.requires_approval, bypass })) {
      throw new ConflictException({ error: 'invalid_status_transition', from: report.status, to });
    }

    const patch: { approver_staff_id?: number; updated_by_staff_id: number } = {
      updated_by_staff_id: actor.staffId,
    };
    if (input.approver_staff_id != null) {
      patch.approver_staff_id = input.approver_staff_id;
    } else if (to === 'approved') {
      patch.approver_staff_id = actor.staffId;
    }

    return this.repo.updateReportStatus(id, to, patch);
  }

  async submitReview(
    actor: CsdActor,
    id: string,
    approverStaffId?: number,
  ): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    const bypass = hasCsdManage(actor);
    const opts = { requires_approval: report.requires_approval, bypass };
    const to: CsdReportStatus =
      !report.requires_approval && canTransitionReport(report.status, 'approved', opts)
        ? 'approved'
        : 'in_review';
    return this.transition(actor, id, { to, approver_staff_id: approverStaffId });
  }

  async approve(actor: CsdActor, id: string): Promise<CsdReportRow> {
    return this.transition(actor, id, { to: 'approved' });
  }

  async send(actor: CsdActor, id: string, input: SendCsdReportInput): Promise<CsdReportSendLogRow> {
    const report = await this.get(actor, id);
    this.assertCanSend(report);

    const to = (input.to ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!to.length) throw new BadRequestException({ error: 'to_required' });

    const scheduled = await this.maybeSchedule(actor, report, input.schedule_at, to);
    if (scheduled) return scheduled;

    try {
      const pdf = await this.exportPdf(actor, id);
      await this.uploadFile(actor, id, {
        originalname: pdf.filename,
        mimetype: 'application/pdf',
        buffer: pdf.buffer,
        size: pdf.buffer.length,
      } as Express.Multer.File);

      const subject = String(input.subject ?? '').trim() || report.title;
      const bodyText = [String(input.body ?? '').trim(), `Tệp: ${pdf.filename}`]
        .filter(Boolean)
        .join('\n');

      const outbound = await this.email.send(actor, {
        to,
        subject,
        body_text: bodyText,
        attachments: [
          { filename: pdf.filename, content_type: 'application/pdf', buffer: pdf.buffer },
        ],
      });

      if (outbound.send_status !== 'sent') {
        return this.recordFailedSend(
          actor,
          report,
          to,
          outbound.send_status === 'queued' ? 'email_send_disabled' : `email_status_${outbound.send_status}`,
          outbound.id,
        );
      }

      const log = await this.repo.insertSendLog({
        report_id: id,
        version: report.current_version,
        to_json: to,
        result: 'sent',
        email_id: outbound.id,
        created_by_staff_id: actor.staffId,
      });
      await this.repo.updateReportStatus(id, 'sent', { updated_by_staff_id: actor.staffId });
      return log;
    } catch (err) {
      if (this.isReportSendFailed(err)) throw err;
      const message = err instanceof Error ? err.message : 'send_failed';
      return this.recordFailedSend(actor, report, to, message);
    }
  }

  async retrySend(actor: CsdActor, id: string): Promise<CsdReportSendLogRow> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_already_sent' });
    }
    const logs = await this.repo.listSendLogs(id);
    const last = logs[0];
    if (!last || last.result !== 'failed') {
      throw new ConflictException({ error: 'retry_not_allowed' });
    }
    return this.send(actor, id, {
      to: last.to_json,
      subject: report.title,
      body: 'Gửi lại báo cáo',
    });
  }

  private assertCanSend(report: CsdReportRow): void {
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_already_sent' });
    }
    if (report.requires_approval && report.status !== 'approved' && report.status !== 'scheduled') {
      throw new ConflictException({ error: 'report_not_approved', status: report.status });
    }
  }

  private async maybeSchedule(
    actor: CsdActor,
    report: CsdReportRow,
    scheduleAt: string | undefined,
    to: string[],
  ): Promise<CsdReportSendLogRow | null> {
    const raw = String(scheduleAt ?? '').trim();
    if (!raw) return null;
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException({ error: 'invalid_schedule_at' });
    }
    if (when.getTime() <= Date.now()) return null;
    if (!report.template_id) {
      throw new BadRequestException({ error: 'template_required' });
    }

    await this.repo.updateReportStatus(report.id, 'scheduled', {
      updated_by_staff_id: actor.staffId,
    });
    await this.repo.upsertScheduleNextRun({
      template_id: report.template_id,
      client_account_id: report.client_account_id,
      next_run_at: when.toISOString(),
      owner_staff_id: report.owner_staff_id ?? actor.staffId,
    });
    return this.repo.insertSendLog({
      report_id: report.id,
      version: report.current_version,
      to_json: to,
      result: 'queued',
      created_by_staff_id: actor.staffId,
    });
  }

  private async recordFailedSend(
    actor: CsdActor,
    report: CsdReportRow,
    to: string[],
    errorText: string,
    emailId?: string | null,
  ): Promise<never> {
    await this.repo.insertSendLog({
      report_id: report.id,
      version: report.current_version,
      to_json: to,
      result: 'failed',
      email_id: emailId ?? null,
      error_text: errorText,
      created_by_staff_id: actor.staffId,
    });
    if (report.owner_staff_id != null) {
      await this.notify.insert({
        staff_id: report.owner_staff_id,
        event_key: 'report_send_failed',
        title_vi: 'Gửi báo cáo thất bại',
        body_vi: errorText,
        entity_type: 'report',
        entity_id: report.id,
        severity: 'warning',
      });
    }
    throw new BadRequestException({ error: 'report_send_failed' });
  }

  private isReportSendFailed(err: unknown): boolean {
    if (!(err instanceof HttpException)) return false;
    const body = err.getResponse();
    return typeof body === 'object' && body != null && (body as { error?: string }).error === 'report_send_failed';
  }

  async updateSections(
    actor: CsdActor,
    id: string,
    sections: Record<string, unknown>,
  ): Promise<{ version: string; sections_json: Record<string, unknown> }> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }

    const version = await this.repo.updateSections(
      id,
      report.current_version,
      sections,
      actor.staffId,
    );
    return { version: version.version, sections_json: version.sections_json };
  }

  async snapshotVersion(
    actor: CsdActor,
    id: string,
    input: SnapshotCsdReportInput,
  ): Promise<CsdReportDetail> {
    const report = await this.get(actor, id);
    const changelog = String(input.changelog ?? '').trim();
    if (changelog.length < 3) {
      throw new BadRequestException({ error: 'changelog_required' });
    }
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_use_revise' });
    }

    const kind = input.kind === 'major' ? 'major' : 'minor';
    const nextVersion = bumpReportVersion(report.current_version, kind);
    const current = await this.repo.getCurrentVersion(id);
    await this.repo.insertVersion({
      report_id: id,
      version: nextVersion,
      changelog,
      sections_json: current?.sections_json ?? {},
      created_by_staff_id: actor.staffId,
      status: report.status,
    });

    const detail = await this.getDetail(actor, id);
    return { ...detail, current_version: nextVersion };
  }

  async rollupTickets(
    actor: CsdActor,
    id: string,
  ): Promise<{ version: string; sections_json: Record<string, unknown> }> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }

    const rows = report.client_account_id
      ? await this.tickets.listForReportPeriod(
          report.client_account_id,
          report.period_start,
          report.period_end,
        )
      : [];
    const current = await this.repo.getCurrentVersion(id);
    const sections = applyTicketRollup(current?.sections_json ?? {}, classifyTickets(rows));
    return this.updateSections(actor, id, sections);
  }

  async uploadFile(actor: CsdActor, id: string, file?: Express.Multer.File): Promise<CsdAttachmentRow> {
    const report = await this.get(actor, id);
    if (report.status === 'sent') {
      throw new ConflictException({ error: 'report_sent_immutable' });
    }
    if (!file?.buffer) throw new BadRequestException({ error: 'file_required' });
    if (file.size <= 0) throw new BadRequestException({ error: 'file_required' });
    if (file.size > FILE_MAX_BYTES) throw new BadRequestException({ error: 'file_too_large' });

    const attachmentId = randomUUID();
    const fileName = safeFileName(file.originalname);
    const storageKey = `report/${id}/${attachmentId}-${fileName}`;
    const absDir = join(fileDir(), 'report', id);
    mkdirSync(absDir, { recursive: true });
    writeFileSync(join(fileDir(), storageKey), file.buffer);

    return this.repo.insertAttachment({
      id: attachmentId,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: file.mimetype || 'application/octet-stream',
      byte_size: file.size,
      visibility: 'internal',
      entity_type: 'report',
      entity_id: id,
      uploaded_by_staff_id: actor.staffId,
    });
  }

  async createRevisedVersion(actor: CsdActor, id: string): Promise<CsdReportRow> {
    const report = await this.get(actor, id);
    if (report.status !== 'sent') {
      throw new ConflictException({ error: 'report_not_sent', status: report.status });
    }

    const current = await this.repo.getCurrentVersion(id);
    const nextVersion = bumpReportVersion(report.current_version, 'major');

    return this.repo.createRevisedVersion(
      id,
      nextVersion,
      actor.staffId,
      current?.sections_json ?? {},
      'Tạo bản sửa sau khi gửi',
    );
  }
}
