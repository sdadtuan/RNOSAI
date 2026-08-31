import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiScoreFeedbackService } from '../ai-intelligence/ai-score-feedback.service';
import { catalogTs } from '../catalog/catalog-slug.util';
import { ChotClosedLoopService } from '../leads/chot-closed-loop.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { TimelineBackfillResult } from '../customer-timeline/customer-timeline.types';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { LeadsRepository } from '../leads/leads.repository';
import { LeadsWriteService } from '../leads/leads-write.service';
import { LeadV1 } from '../leads/leads.types';
import { CrmLeadsPgRepository } from './crm-leads-pg.repository';
import { StaffMentionService } from '../staff-notifications/staff-mention.service';
import {
  AssignLeadBody,
  CreateLeadActivityBody,
  LeadActivityRow,
  LeadAssignmentLogRow,
  LeadStatusLogRow,
} from './crm-leads-legacy.types';

@Injectable()
export class CrmLeadsLegacyService {
  constructor(
    private readonly pg: CrmLeadsPgRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly leadsWrite: LeadsWriteService,
    private readonly timeline: CustomerTimelineService,
    private readonly mentions: StaffMentionService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly scoreFeedback: AiScoreFeedbackService,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
  ) {}

  private async assertLead(leadId: number): Promise<void> {
    const lead = await this.leadsRepo.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'Không tìm thấy lead.' });
    }
  }

  async listActivities(leadId: number, limit?: number): Promise<LeadActivityRow[]> {
    await this.assertLead(leadId);
    return this.pg.listActivities(leadId, limit ?? 100);
  }

  async createActivity(
    leadId: number,
    body: CreateLeadActivityBody,
    actor: string,
    userId: number | null,
  ): Promise<{ activity: LeadActivityRow }> {
    await this.assertLead(leadId);
    const activity = await this.pg.createActivity(leadId, body, actor, userId);
    await this.timeline.recordActivityFromLegacy(leadId, activity);
    const content = String(body.content ?? '');
    if (content.includes('@')) {
      void this.mentions
        .notifyActivityMentions({ leadId, content, actorEmail: actor })
        .catch(() => undefined);
    }
    return { activity };
  }

  async auditLogs(
    leadId: number,
  ): Promise<{ status_logs: LeadStatusLogRow[]; assignment_logs: LeadAssignmentLogRow[] }> {
    await this.assertLead(leadId);
    return {
      status_logs: await this.pg.listStatusLogs(leadId),
      assignment_logs: await this.pg.listAssignmentLogs(leadId),
    };
  }

  async assignLead(
    leadId: number,
    body: AssignLeadBody,
    actor: string,
  ): Promise<{ lead: LeadV1 }> {
    const toId = Number(body.to_user_id ?? body.owner_id ?? 0);
    const reason = String(body.reason ?? '').trim();
    if (!toId) {
      throw new BadRequestException({ error: 'to_user_id không hợp lệ' });
    }
    if (!reason) {
      throw new BadRequestException({ error: 'Cần ghi lý do phân lại.' });
    }
    const staffOk = await this.pg.staffExists(toId);
    if (!staffOk) {
      throw new BadRequestException({ error: 'Nhân viên không hợp lệ hoặc đã ngưng.' });
    }
    await this.assertLead(leadId);

    const fromId = await this.pg.getLeadOwnerId(leadId);
    const ts = catalogTs();
    const lead = await this.leadsWrite.patchLead(
      leadId,
      { owner_id: toId, assigned_by: actor },
      actor,
    );

    await this.pg.logAssignment(leadId, fromId, toId, reason, actor, ts);
    const assignActivity = await this.pg.createActivity(
      leadId,
      { activity_type: 'system', content: `Phân lại lead: ${reason}` },
      actor,
      toId,
    );
    await this.timeline.recordActivityFromLegacy(leadId, assignActivity);

    return { lead };
  }

  async finalizeLeadPatch(input: {
    leadId: number;
    prev: LeadV1;
    next: LeadV1;
    actor: string;
    auditNote?: string;
  }): Promise<void> {
    const note = String(input.auditNote ?? '').trim();
    await this.mirrorPatchAudit(input.leadId, input.prev, input.next, input.actor, note);
    await this.closedLoop.processAfterPatch({
      leadId: input.leadId,
      prevStatus: input.prev.status,
      nextStatus: input.next.status,
      auditNote: note,
      actor: input.actor,
    });
    await this.scoreFeedback.onLeadTerminalStatus(input.leadId, String(input.next.status ?? ''));
    await this.enqueueTerminalLearn(input.leadId, input.prev.status, input.next.status, input.next);
  }

  private async enqueueTerminalLearn(
    leadId: number,
    prevStatus: string | null | undefined,
    nextStatus: string | null | undefined,
    lead: { status?: string | null; client_id?: string | null; agency_client_id?: string | null },
  ): Promise<void> {
    const next = String(nextStatus ?? '').trim().toLowerCase();
    const prev = String(prevStatus ?? '').trim().toLowerCase();
    if (next !== 'chot' && next !== 'lost') return;
    if (prev === next) return;
    const clientId =
      lead.client_id ?? lead.agency_client_id ?? null;
    void this.lmpEnqueue.enqueueAfterTerminalStatus(
      leadId,
      next as 'chot' | 'lost',
      clientId,
    );
  }

  async mirrorPatchAudit(
    leadId: number,
    prev: LeadV1,
    next: LeadV1,
    actor: string,
    note = '',
  ): Promise<void> {
    const pgLead = await this.leadsRepo.getLeadById(leadId);
    if (!pgLead) return;
    const ts = catalogTs();
    if (next.status && prev.status !== next.status) {
      await this.timeline.recordStatusChange({
        leadId,
        from: prev.status,
        to: next.status,
        actorId: actor,
        note,
        occurredAt: ts,
      });
    }
    if (prev.owner_id !== next.owner_id && next.owner_id != null) {
      await this.pg.logAssignment(
        leadId,
        prev.owner_id ?? null,
        next.owner_id,
        note || 'Cập nhật owner qua ops-web',
        actor,
        ts,
      );
    }
  }

  /** AI-UC-008 — mirror legacy activities / ingest rows for leads missing timeline. */
  async backfillTimelineBatch(limit = 50): Promise<TimelineBackfillResult> {
    const batchLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const leadIds = await this.timeline.listLeadIdsMissingTimeline(batchLimit);
    let eventsMirrored = 0;

    for (const leadId of leadIds) {
      const activities = await this.pg.listActivities(leadId, 200);
      if (activities.length) {
        for (const activity of activities) {
          const row = await this.timeline.recordActivityFromLegacy(leadId, activity);
          if (row) {
            eventsMirrored += 1;
          }
        }
        continue;
      }

      const pgLead = await this.leadsRepo.getLeadById(leadId);
      if (pgLead) {
        await this.timeline.recordLeadCreatedFromV1(pgLead);
        eventsMirrored += 1;
      }
    }

    const leadsRemaining = await this.timeline.countLeadsMissingTimeline();
    return {
      leads_processed: leadIds.length,
      events_mirrored: eventsMirrored,
      leads_remaining: leadsRemaining,
    };
  }
}
