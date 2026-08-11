import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadsRepository } from '../leads/leads.repository';
import { planContentFromRow } from '../leads-funnel/presales-marketing-plan.util';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { AppConfigService } from '../config/app-config.service';
import { buildDealRoomGates } from './deal-room-gates.util';
import type { DealRoomSnapshot } from './deal-room.types';

@Injectable()
export class DealRoomService {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly leads: LeadsRepository,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly config: AppConfigService,
  ) {}

  async getSnapshot(leadId: number): Promise<DealRoomSnapshot> {
    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const funnel = await this.funnel.getFunnel(leadId);
    if (!funnel.presales) {
      throw new BadRequestException({
        error: 'presales_required',
        message: 'Bắt đầu Pre-sales trước khi mở Deal Room.',
      });
    }

    const flowKind = String(funnel.lead_flow_kind ?? '').trim();
    if (flowKind !== 'b2b_prospect' && flowKind !== 'b2b') {
      throw new BadRequestException({
        error: 'deal_room_b2b_only',
        message: 'Deal Room chỉ khả dụng cho lead B2B prospect.',
      });
    }

    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    const proposalGate = gateResp.gate;
    const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
    const handoff = handoffResp.handoff;
    const planResp = await this.funnel.getMarketingPlan(leadId);
    const planRow = planResp.plan as Record<string, unknown>;
    const planContent = planContentFromRow(planRow);

    const consultDone = proposalGate.consult_task_done_count;
    const consultTotal = proposalGate.consult_task_total;
    const presalesStage = funnel.presales.presales.stage;

    const gates = buildDealRoomGates({
      careGateComplete: Boolean(funnel.presales_care_gate?.complete),
      consultDone,
      consultTotal,
      proposalGate,
      presalesStage,
    });

    const ownerId = lead.owner_id;
    let ownerName: string | null = null;
    if (ownerId) {
      ownerName = this.leadSqlite.staffNamesByIds([ownerId]).get(ownerId) ?? null;
    }

    const canCreateQuote = proposalGate.ok && handoff.can_open;
    const quoteBlockReason = !proposalGate.ok
      ? proposalGate.messages[0] ?? 'Hoàn thành G4 R5 trước khi tạo báo giá'
      : handoff.block_reason || '';

    return {
      ok: true,
      lead_id: leadId,
      lead_name: lead.full_name,
      lead_flow_kind: flowKind,
      owner_id: ownerId,
      owner_name: ownerName,
      presales: funnel.presales,
      gates,
      marketing_plan: {
        name: planContent.name,
        north_star: planContent.north_star,
        objectives: planContent.objectives,
        strategy_framework: planContent.strategy_framework,
        validation_ok: Boolean(planResp.validation?.ok),
        validation_messages: planResp.validation?.messages ?? [],
      },
      consult_progress: { done: consultDone, total: consultTotal },
      quote: {
        proposal_id: null,
        status: null,
        total_vnd: null,
        tiers: [],
        can_create: canCreateQuote,
        block_reason: canCreateQuote ? '' : quoteBlockReason,
      },
      actions: {
        can_export_pack: proposalGate.ok && this.config.dealRoomPackPdf,
        can_share_teaser: false,
        proposals_href: handoff.proposals_href,
      },
      proposal_gate: proposalGate,
    };
  }
}
