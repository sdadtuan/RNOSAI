import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdAuditRepository } from '../csd/csd-audit.repository';
import { sendIwrChannelNotification } from './iwr-channel.adapter';
import { isExternalEmailAllowed, parseExternalEmailAllowlist } from './iwr-external.util';
import { IwrReportsService } from './iwr-reports.service';
import { IwrW5Repository } from './iwr-w5.repository';
import { IwrW6Repository } from './iwr-w6.repository';
import type { IwrActor } from './iwr.types';

const SHARE_TTL_DAYS = 7;

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PTT_API_URL?.replace(/\/api\/?$/, '') ??
    process.env.PTT_OPS_PUBLIC_URL ??
    'https://rs.pttads.vn'
  )
    .trim()
    .replace(/\/$/, '');
}

@Injectable()
export class IwrExternalService {
  constructor(
    private readonly shares: IwrW6Repository,
    private readonly approvals: IwrW5Repository,
    private readonly reports: IwrReportsService,
    private readonly audit: CsdAuditRepository,
  ) {}

  async list(actor: IwrActor) {
    const items = await this.shares.listShares(actor.staffId, hasCap(actor, 'manage'));
    return { items };
  }

  async requestShare(
    actor: IwrActor,
    reportId: string,
    email: string,
    approverStaffId: number,
  ): Promise<{ approval_id: string }> {
    if (!hasCap(actor, 'external')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'external' });
    }
    const normalized = String(email ?? '').trim().toLowerCase();
    const allowlist = parseExternalEmailAllowlist();
    if (!isExternalEmailAllowed(normalized, allowlist)) {
      throw new BadRequestException({ error: 'iwr_external_not_allowlisted' });
    }
    await this.reports.get(actor, reportId);
    const approval = await this.approvals.insertApproval({
      report_id: reportId,
      kind: 'other',
      requester_staff_id: actor.staffId,
      approver_staff_id: approverStaffId,
      payload_json: { type: 'external_share', allow_email: normalized },
    });
    await this.audit.insert({
      actor_staff_id: actor.staffId,
      action: 'iwr.external_request',
      entity_type: 'iwr_report',
      entity_id: reportId,
      after_json: { approval_id: approval.id, allow_email: normalized },
    });
    return { approval_id: approval.id };
  }

  async approveShare(
    actor: IwrActor,
    approvalId: string,
  ): Promise<{ url: string; expires_at: string; share_id: string }> {
    const approval = await this.approvals.getApproval(approvalId);
    if (!approval) throw new NotFoundException({ error: 'iwr_approval_not_found' });
    if (approval.approver_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const email = String(approval.payload_json?.allow_email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException({ error: 'iwr_external_email_missing' });

    const expires = new Date(Date.now() + SHARE_TTL_DAYS * 86400_000);
    const share = await this.shares.insertShare({
      report_id: approval.report_id,
      approval_id: approvalId,
      allow_email: email,
      expires_at: expires.toISOString(),
      created_by_staff_id: actor.staffId,
    });

    await this.approvals.decideApproval(approvalId, actor.staffId, 'approved', 'external share');

    const url = `${publicBaseUrl()}/iwr/share/${share.token}`;
    await sendIwrChannelNotification({
      event: 'report.external_share',
      report_id: approval.report_id,
      message: `Secure link created for ${email}`,
    });
    await this.audit.insert({
      actor_staff_id: actor.staffId,
      action: 'iwr.external_approve',
      entity_type: 'iwr_external_share',
      entity_id: share.id,
      after_json: { url, expires_at: share.expires_at },
    });
    return { url, expires_at: share.expires_at, share_id: share.id };
  }

  async revoke(actor: IwrActor, shareId: string): Promise<{ ok: true }> {
    const share = await this.shares.getShare(shareId);
    if (!share) throw new NotFoundException({ error: 'iwr_share_not_found' });
    if (share.created_by_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const row = await this.shares.revokeShare(shareId);
    if (!row) throw new NotFoundException({ error: 'iwr_share_not_found' });
    await this.audit.insert({
      actor_staff_id: actor.staffId,
      action: 'iwr.external_revoke',
      entity_type: 'iwr_external_share',
      entity_id: shareId,
    });
    return { ok: true };
  }

  async viewPublicShare(token: string): Promise<Record<string, unknown>> {
    const share = await this.shares.getShareByToken(token);
    if (!share) throw new NotFoundException({ error: 'iwr_share_not_found' });
    const report = await this.reports.exportPublicSnapshot(share.report_id);
    return {
      allow_email: share.allow_email,
      expires_at: share.expires_at,
      report,
    };
  }
}
