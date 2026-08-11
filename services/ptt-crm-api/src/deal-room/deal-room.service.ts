import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { LeadsRepository } from '../leads/leads.repository';
import { planContentFromRow } from '../leads-funnel/presales-marketing-plan.util';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmLeadsSqliteRepository } from '../crm-leads-legacy/crm-leads-sqlite.repository';
import { AppConfigService } from '../config/app-config.service';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { resolveDvByLifecycleSlug } from '../ops/ops-slug-resolver.util';
import { ProposalsSqliteRepository } from '../proposals/proposals-sqlite.repository';
import {
  QUOTE_PACKAGE_TIERS,
  QUOTE_TIER_VI,
  resolveTierPricing,
  type QuotePackageTier,
} from '../proposals/quote-pricing.util';
import { buildDealRoomGates } from './deal-room-gates.util';
import { buildL1GateChecklist } from '../leads-funnel/presales-l1-gate-checklist.util';
import type { ExportDealRoomPackBody } from './deal-room-export.types';
import {
  buildDealRoomPackPdf,
  dealPackExportFilename,
  type DealRoomPackQuoteLine,
  type DealRoomPackTierQuote,
} from './deal-room-pack.util';
import type { DealRoomSnapshot } from './deal-room.types';
import { catalogTs } from '../catalog/catalog-slug.util';

@Injectable()
export class DealRoomService {
  constructor(
    private readonly funnel: LeadsFunnelService,
    private readonly leads: LeadsRepository,
    private readonly leadSqlite: CrmLeadsSqliteRepository,
    private readonly legacy: CrmLeadsLegacyService,
    private readonly proposals: ProposalsSqliteRepository,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly opsProfiles: OpsProfilePgRepository,
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
    const quoteBlockReason = !canCreateQuote
      ? handoff.block_reason ||
        proposalGate.messages[0] ||
        'Hoàn thành G4 R5 trước khi tạo báo giá'
      : '';

    const l1Checklist = buildL1GateChecklist({
      gate: proposalGate,
      plan: {
        name: planContent.name,
        north_star: planContent.north_star,
        objectives: planContent.objectives,
        strategy_framework: planContent.strategy_framework,
      },
    });

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
      l1_checklist: l1Checklist,
    };
  }

  async exportPack(
    leadId: number,
    body: ExportDealRoomPackBody,
    actor: string,
    userId: number | null,
  ): Promise<StreamableFile> {
    if (!this.config.dealRoomPackPdf) {
      throw new ForbiddenException({
        error: 'deal_room_pack_disabled',
        message: 'Bật PTT_DEAL_ROOM_PACK_PDF=1 để export Plan+Quote Pack.',
      });
    }

    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    if (!gateResp.gate.ok) {
      throw new BadRequestException({
        error: 'g4_blocked',
        messages: gateResp.gate.messages,
        message: gateResp.gate.messages[0] ?? 'Hoàn thành G4 R5 trước khi export Pack PDF.',
      });
    }

    const snapshot = await this.getSnapshot(leadId);
    const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
    const customerId = handoffResp.handoff.customer_id;
    const serviceSlug = String(snapshot.presales.presales.service_slug ?? '').trim();
    const exportDate = catalogTs().slice(0, 10);

    const proposalId = this.resolveProposalId(customerId, body.proposal_id ?? null);
    const quoteTiers = await this.buildQuoteTiers(serviceSlug, proposalId);
    const showAiDisclaimer = this.detectAiDraft(snapshot);

    const solutionName = snapshot.presales.handoff?.solution_owner_name?.trim() || null;

    const pdf = buildDealRoomPackPdf({
      lead_id: leadId,
      lead_name: snapshot.lead_name,
      service_slug: serviceSlug,
      export_date: exportDate,
      owner_name: snapshot.owner_name,
      solution_name: solutionName,
      marketing_plan: snapshot.marketing_plan,
      quote_tiers: quoteTiers,
      proposal_id: proposalId,
      include_timeline: body.include_timeline !== false,
      show_ai_disclaimer: showAiDisclaimer,
    });

    await this.legacy.createActivity(
      leadId,
      {
        activity_type: 'deal_room_pack_exported',
        content: `Export Plan+Quote Pack PDF${proposalId ? ` · proposal #${proposalId}` : ''}`,
        result: 'ok',
      },
      actor,
      userId,
    );

    const filename = dealPackExportFilename(leadId, exportDate);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  private resolveProposalId(customerId: number | null, requestedId: number | null): number | null {
    if (requestedId != null && requestedId > 0) {
      const proposal = this.proposals.getById(requestedId);
      if (!proposal) {
        throw new NotFoundException({ error: 'proposal_not_found', proposal_id: requestedId });
      }
      if (customerId != null && customerId > 0 && proposal.customer_id !== customerId) {
        throw new BadRequestException({
          error: 'proposal_customer_mismatch',
          message: 'Proposal không thuộc khách hàng của lead này.',
        });
      }
      return requestedId;
    }
    if (customerId == null || customerId <= 0) return null;
    const rows = this.proposals.listByCustomer(customerId);
    const draft = rows.find((p) => p.status === 'draft') ?? rows[0];
    return draft?.id ?? null;
  }

  private async buildQuoteTiers(
    serviceSlug: string,
    proposalId: number | null,
  ): Promise<DealRoomPackTierQuote[]> {
    const map = this.routeMap.getMap();
    const dvEntry = resolveDvByLifecycleSlug(serviceSlug, map);
    const dvCode = dvEntry?.code ?? 'DV04';
    const dvName = dvEntry?.name_vi ?? dvCode;

    let tierPricing: Record<string, unknown> = {};
    if (this.opsProfiles.canUsePg()) {
      const profile = await this.opsProfiles.getByDvCode(dvCode);
      if (profile?.tier_pricing) tierPricing = profile.tier_pricing;
    }

    const proposalLines = proposalId ? this.proposals.listLines(proposalId) : [];
    const linesByTier = new Map<string, DealRoomPackQuoteLine[]>();
    for (const line of proposalLines) {
      const tier = String(line.package_tier ?? 'standard').toLowerCase();
      const entry = map.services.find((s) => s.code === line.dv_code);
      const bucket = linesByTier.get(tier) ?? [];
      bucket.push({
        dv_code: line.dv_code,
        dv_name: entry?.name_vi ?? line.dv_code,
        package_tier: line.package_tier,
        final_price_vnd: line.final_price_vnd,
        scope_notes: line.scope_notes,
      });
      linesByTier.set(tier, bucket);
    }

    return QUOTE_PACKAGE_TIERS.map((tier: QuotePackageTier) => {
      const tierLines = linesByTier.get(tier) ?? [];
      if (tierLines.length) {
        const total = tierLines.reduce((sum, l) => sum + Number(l.final_price_vnd || 0), 0);
        return {
          tier,
          tier_label: QUOTE_TIER_VI[tier],
          lines: tierLines,
          total_vnd: total,
        };
      }
      const ref = resolveTierPricing(tierPricing, tier);
      return {
        tier,
        tier_label: QUOTE_TIER_VI[tier],
        lines: [
          {
            dv_code: dvCode,
            dv_name: dvName,
            package_tier: tier,
            final_price_vnd: ref.suggested_vnd,
          },
        ],
        total_vnd: ref.suggested_vnd,
        is_reference: true,
      };
    });
  }

  private detectAiDraft(snapshot: DealRoomSnapshot): boolean {
    const consultTasks = snapshot.presales.tasks?.consult ?? [];
    return consultTasks.some((t) => String(t.ai_output ?? '').trim().length > 0);
  }
}
