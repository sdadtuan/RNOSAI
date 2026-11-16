import { Injectable, Logger, Optional } from '@nestjs/common';
import { PortalCareRepository } from './portal-care.repository';
import { PortalNotificationRepository } from './portal-notification.repository';
import { PortalNotificationService } from './portal-notification.service';
import {
  careAssignedCopy,
  careCaseLink,
  careMessageCopy,
  careReassignedCopy,
  sameAssignee,
  shouldSkipDuplicateMessage,
  type CareNotifyReason,
} from './portal-care-notify.util';

export interface CareAssignmentNotifyInput {
  clientId: string;
  caseId: string;
  assigneeId: string | null;
  previousAssigneeId: string | null;
  reason: CareNotifyReason;
  title?: string;
  kind?: string;
}

export interface CareInboundMessageInput {
  page_id: string;
  sender_name?: string;
  sender_psid?: string;
  body?: string;
}

@Injectable()
export class PortalCareNotifyService {
  private readonly log = new Logger(PortalCareNotifyService.name);

  constructor(
    private readonly notifications: PortalNotificationService,
    private readonly repo: PortalCareRepository,
    @Optional() private readonly notificationRepo?: PortalNotificationRepository,
  ) {}

  async notifyAssignment(input: CareAssignmentNotifyInput): Promise<void> {
    if (sameAssignee(input.previousAssigneeId, input.assigneeId)) return;
    const info = await this.caseInfo(input.clientId, input.caseId, input.title, input.kind);
    const link = careCaseLink(info.kind, input.caseId);
    const meta = {
      case_id: input.caseId,
      kind: info.kind,
      reason: input.reason,
    };

    if (input.previousAssigneeId && input.previousAssigneeId !== input.assigneeId) {
      const copy = careReassignedCopy(info.title, info.kind);
      await this.safe(
        () =>
          this.notifications.emitToUser({
            clientId: input.clientId,
            portalUserId: input.previousAssigneeId as string,
            category: 'care_reassigned',
            title: copy.title,
            body: copy.body,
            linkUrl: link,
            meta: { ...meta, next_assignee_user_id: input.assigneeId },
          }),
        'care_reassigned',
      );
    }

    if (input.assigneeId) {
      const copy = careAssignedCopy(info.title, info.kind);
      await this.safe(
        () =>
          this.notifications.emitToUser({
            clientId: input.clientId,
            portalUserId: input.assigneeId as string,
            category: 'care_assigned',
            title: copy.title,
            body: copy.body,
            linkUrl: link,
            meta: { ...meta, previous_assignee_user_id: input.previousAssigneeId },
          }),
        'care_assigned',
      );
    }
  }

  async notifyInboundMessages(clientId: string, messages: CareInboundMessageInput[]): Promise<void> {
    const inbound = messages.filter((row) => row.page_id);
    if (!inbound.length) return;
    let cases: Array<{
      id: string;
      title: string;
      kind: string;
      assignee_user_id: string | null;
      page_id: string;
    }> = [];
    try {
      cases = (await this.repo.casesForSenders(
        clientId,
        inbound.map((row) => ({
          page_id: row.page_id,
          sender_psid: row.sender_psid,
          sender_name: row.sender_name,
        })),
      )) as typeof cases;
    } catch (err) {
      this.log.warn(
        `care inbound case lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    const previewByKey = new Map<string, string>();
    for (const msg of inbound) {
      const key = msg.sender_psid
        ? `${msg.page_id}:psid:${msg.sender_psid}`
        : `${msg.page_id}:name:${String(msg.sender_name ?? '').toLowerCase()}`;
      if (!previewByKey.has(key)) previewByKey.set(key, String(msg.body ?? '').trim());
    }

    const seen = new Set<string>();
    for (const row of cases) {
      const assignee = row.assignee_user_id?.trim();
      if (!assignee) continue;
      const dedupeKey = `${assignee}:${row.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const preview =
        previewByKey.get(`${row.page_id}:psid:`) ||
        this.previewForCase(row, inbound);
      await this.notifyInboundOnCase({
        clientId,
        caseId: row.id,
        assigneeId: assignee,
        title: row.title,
        kind: row.kind,
        preview,
      });
    }
  }

  async notifyInboundOnCase(input: {
    clientId: string;
    caseId: string;
    assigneeId: string;
    title?: string;
    kind?: string;
    preview?: string;
  }): Promise<void> {
    const hasUnread = await this.hasUnreadMessage(input.clientId, input.assigneeId, input.caseId);
    if (shouldSkipDuplicateMessage(hasUnread)) return;
    const kind = input.kind || 'message';
    const copy = careMessageCopy(input.title ?? '', input.preview ?? '');
    await this.safe(
      () =>
        this.notifications.emitToUser({
          clientId: input.clientId,
          portalUserId: input.assigneeId,
          category: 'care_message',
          title: copy.title,
          body: copy.body,
          linkUrl: careCaseLink(kind, input.caseId),
          meta: { case_id: input.caseId, kind },
        }),
      'care_message',
    );
  }

  private previewForCase(
    row: { page_id: string; title: string },
    messages: CareInboundMessageInput[],
  ): string {
    const match = messages.find((msg) => {
      if (msg.page_id !== row.page_id) return false;
      if (msg.sender_psid) return true;
      return String(msg.sender_name ?? '').toLowerCase() === String(row.title ?? '').toLowerCase();
    });
    return String(match?.body ?? '').trim();
  }

  private async hasUnreadMessage(clientId: string, portalUserId: string, caseId: string): Promise<boolean> {
    if (!this.notificationRepo?.findUnreadByCase) return false;
    try {
      const existing = await this.notificationRepo.findUnreadByCase({
        clientId,
        portalUserId,
        category: 'care_message',
        caseId,
      });
      return Boolean(existing);
    } catch (err) {
      this.log.warn(`care message dedupe lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  private async caseInfo(
    clientId: string,
    caseId: string,
    title?: string,
    kind?: string,
  ): Promise<{ title: string; kind: string }> {
    if (title != null && kind) return { title, kind };
    try {
      const row = await this.repo.findCase(clientId, caseId);
      return {
        title: title ?? String(row?.title ?? ''),
        kind: kind ?? String(row?.kind ?? 'message'),
      };
    } catch {
      return { title: title ?? '', kind: kind ?? 'message' };
    }
  }

  private async safe(fn: () => Promise<unknown>, label: string): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.log.warn(`portal care notify ${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
