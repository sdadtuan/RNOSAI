import { Injectable } from '@nestjs/common';
import { AiScoreFeedbackService } from '../ai-intelligence/ai-score-feedback.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { ChotClosedLoopService } from './chot-closed-loop.service';
import { LeadV1 } from './leads.types';

@Injectable()
export class LeadPatchFinalizeService {
  constructor(
    private readonly crmLegacy: CrmLeadsLegacyService,
    private readonly closedLoop: ChotClosedLoopService,
    private readonly scoreFeedback: AiScoreFeedbackService,
    private readonly lmpEnqueue: LeadMeetingPrepEnqueueService,
  ) {}

  async finalize(input: {
    leadId: number;
    prev: LeadV1;
    next: LeadV1;
    actor: string;
    auditNote?: string;
  }): Promise<void> {
    const note = String(input.auditNote ?? '').trim();
    await this.crmLegacy.mirrorPatchAudit(
      input.leadId,
      input.prev,
      input.next,
      input.actor,
      note,
    );
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
    const clientId = lead.client_id ?? lead.agency_client_id ?? null;
    void this.lmpEnqueue.enqueueAfterTerminalStatus(leadId, next as 'chot' | 'lost', clientId);
  }
}
