import { BadRequestException, Injectable } from '@nestjs/common';
import { buildLatestIntakeSummary } from '../../service-lifecycle/lifecycle-consult.util';
import {
  TARGET_MARKET_PROF_KEYS,
  OFFICIAL_TMMT_CORE_KEYS,
} from '../../service-lifecycle/lifecycle-marketing-plan.util';
import {
  evaluateWinningPlanGate,
} from './ops-winning-plan-gate.util';
import {
  OpsPresalesContextRepository,
  type PresalesIntakeRow,
} from './ops-presales-context.repository';
import type {
  CrmPresalesContextPack,
  CrmPresalesPack,
  PresalesContextInput,
} from './ops-presales-context.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function discoveryAnswered(answers: Record<string, unknown>): string {
  const phone = answers.phone;
  if (!phone || typeof phone !== 'object') return '0/?';
  const keys = Object.keys(phone as Record<string, unknown>);
  const answered = keys.filter((k) => String((phone as Record<string, unknown>)[k] ?? '').trim()).length;
  return `${answered}/${Math.max(keys.length, 12)}`;
}

function redFlagCount(answers: Record<string, unknown>): number {
  const flags = answers.red_flags;
  if (!Array.isArray(flags)) return 0;
  return flags.map((x) => String(x).trim()).filter(Boolean).length;
}

function decisionLabel(raw: string): string {
  const d = String(raw ?? '').trim().toLowerCase();
  if (d === 'go') return 'Go';
  if (d === 'nurture') return 'Nurture';
  if (d === 'no_go') return 'No-Go';
  return d || '—';
}

function bantSync(intake: PresalesIntakeRow | null): {
  sync_ok: boolean;
  sync_issues: string[];
} {
  if (!intake) return { sync_ok: false, sync_issues: ['no_completed_intake'] };
  const live = Number(intake.bant_total) || 0;
  const issues: string[] = [];
  const staleInDb = /\bBANT\s*:?\s*(\d+)\s*\/\s*30\b/i.exec(String(intake.ai_summary ?? ''));
  if (staleInDb && Number(staleInDb[1]) !== live) {
    issues.push(`consult_shows_${staleInDb[1]}_30_while_intake_${live}_30`);
  }
  // Consult brief display uses live BANT via buildLatestIntakeSummary — sync_ok when live score known.
  const display = buildLatestIntakeSummary({
    id: intake.id,
    bant_total: live,
    decision: intake.decision,
    decision_reason: '',
    ai_summary: intake.ai_summary,
  } as never);
  const displayOk = display.includes(`BANT: ${live}/30`);
  // sync_ok true when display path matches intake (P6 display fix); DB ai_summary staleness → issue note only.
  return {
    sync_ok: displayOk,
    sync_issues: issues,
  };
}

@Injectable()
export class OpsPresalesContextService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async buildPack(input: Record<string, unknown>): Promise<CrmPresalesContextPack> {
    const parsed = this.parseInput(input);
    const known: string[] = [];
    const assumed: string[] = [];
    const unknown: string[] = [];
    const links: string[] = [];

    let client =
      parsed.client_id != null ? await this.repo.resolveClientId(parsed.client_id) : null;

    let lifecycle =
      parsed.lifecycle_id != null
        ? await this.repo.getLifecycleDetail(parsed.lifecycle_id)
        : null;
    if (!lifecycle && parsed.plan_id != null) {
      lifecycle = await this.repo.findLifecycleByPlan(parsed.plan_id);
      if (lifecycle) known.push(`Resolved lifecycle #${lifecycle.id} via plan_id`);
    }
    if (!lifecycle && parsed.lead_id != null) {
      lifecycle = await this.repo.findLifecycleByLead(parsed.lead_id);
      if (lifecycle) known.push(`Resolved lifecycle #${lifecycle.id} via lead_id`);
    }
    if (!lifecycle && client) {
      lifecycle = await this.repo.findLifecycleByClient(client.id);
      if (lifecycle) known.push(`Resolved lifecycle #${lifecycle.id} via client`);
    }

    const leadId = parsed.lead_id ?? lifecycle?.lead_id ?? null;
    const planId = parsed.plan_id ?? lifecycle?.marketing_plan_id ?? null;

    if (!client && lifecycle?.agency_client_id) {
      client = await this.repo.resolveClientId(lifecycle.agency_client_id);
      if (client) assumed.push('client_id inferred from lifecycle contract');
    }

    const lead = leadId != null ? await this.repo.getLead(leadId) : null;
    const intake = await this.repo.getLatestCompletedIntake(leadId, lifecycle?.id ?? null);
    const plan = await this.repo.getOfficialPlan(planId);
    const contract = await this.repo.getContract(lifecycle?.contract_id ?? null);
    const proposals = await this.repo.listProposals({
      leadId,
      clientId: client?.id ?? contract?.agency_client_id ?? null,
    });
    const l2 = await this.repo.getPresalesL2Docs(leadId);
    const approvedIds = await this.repo.listApprovedInsightIds(client?.id ?? null, leadId);
    const hubMaps = await this.repo.countHubCampaignMaps(client?.id ?? null);

    const { strategy_framework, target_market_prof } = this.repo.parseOfficialPlan(plan);
    const tmmtValidation = this.repo.validateOfficialPlan(plan);
    const filled = TARGET_MARKET_PROF_KEYS.filter((k) =>
      String(target_market_prof[k] ?? '').trim(),
    ).length;
    const missing = [
      ...OFFICIAL_TMMT_CORE_KEYS.filter((k) => !String(target_market_prof[k] ?? '').trim()),
      ...(!String(strategy_framework.target_market ?? '').trim() ? (['geography'] as const) : []),
    ].map((k) => (k === 'segmentation_icp' ? 'icp' : k === 'pains_desired_outcomes' ? 'pains_outcomes' : k));

    const geoText = [
      target_market_prof.geo_behavior,
      strategy_framework.target_market,
      target_market_prof.market_context,
    ]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const geographyResolved = /việt\s*nam|vietnam|hcm|hà\s*nội|ha\s*noi|đà\s*nẵng|toàn\s*quốc|nationwide|geo/i.test(
      geoText,
    ) || Boolean(String(target_market_prof.geo_behavior ?? '').trim());

    const sync = bantSync(intake);
    if (sync.sync_issues.some((i) => i.startsWith('consult_ai_summary_'))) {
      assumed.push('ai_summary_db_may_be_stale; consult brief uses live BANT');
    }

    const [amName, spName] = await Promise.all([
      this.repo.staffName(lifecycle?.assigned_am ?? null),
      this.repo.staffName(lifecycle?.assigned_sp ?? null),
    ]);

    const positiveProposals = proposals.filter((p) => Number(p.payable_vnd ?? 0) > 0);
    const qtCodes = proposals
      .map((p) => p.quote_code)
      .filter((c): c is string => Boolean(c?.trim()));
    const proposalGaps: string[] = [];
    if (proposals.length === 0) proposalGaps.push('no_proposals');
    if (!positiveProposals.length) proposalGaps.push('totals_zero');
    if (proposals.some((p) => Number(p.payable_vnd ?? 0) === 0 && String(p.status) === 'draft')) {
      proposalGaps.push('zero_vnd_drafts_present');
    }
    if (qtCodes.length === 0) proposalGaps.push('no_qt_codes');

    const l2Gaps: string[] = [];
    const adsReadable = l2.ads_account_read ?? l2.ads_account_readable ?? null;
    const pixel = l2.pixel_capi ?? l2.pixel ?? null;
    if (adsReadable === false || adsReadable == null) l2Gaps.push('ads_account_readable');
    if (pixel === false || pixel == null) l2Gaps.push('pixel_capi');

    const hubGaps: string[] = [];
    if (hubMaps === 0) hubGaps.push('no_campaign_map');
    if (!client) hubGaps.push('agency_client_missing');

    if (lead) known.push(`Lead #${lead.id} ${lead.full_name || ''}`.trim());
    else unknown.push('lead');
    if (intake) known.push(`Intake #${intake.id} BANT ${intake.bant_total}/30 ${intake.decision}`);
    else unknown.push('bant_intake');
    if (plan) known.push(`Plan #${plan.id} TMMT ${filled}/12 gate=${tmmtValidation.ok}`);
    else unknown.push('official_plan');
    if (contract) known.push(`Contract #${contract.id} value=${contract.amount_vnd}`);
    else unknown.push('contract');
    if (approvedIds.length) known.push(`Approved insights=${approvedIds.length}`);
    else unknown.push('approved_insight');

    if (lifecycle) links.push(`/crm/service-delivery/${lifecycle.id}?tab=tmmt`);
    if (planId) links.push(`/crm/marketing-plan/${planId}`);
    if (leadId) links.push(`/crm/leads/${leadId}`);
    if (client) links.push(`/agency/clients/${client.id}`);

    const gate = evaluateWinningPlanGate(
      {
        tmmt_gate_passed: tmmtValidation.ok,
        tmmt_progress: `${filled}/12`,
        approved_insight_count: approvedIds.length,
        geography_resolved: geographyResolved,
      },
      { lifecycle_id: lifecycle?.id ?? null, plan_id: planId },
    );

    if (contract && contract.amount_vnd > 0) {
      assumed.push(
        `contract_value_vnd=${contract.amount_vnd}; media_vs_fee_split_unspecified`,
      );
    } else {
      unknown.push('media_budget_split');
    }

    const blockersForWinning: Array<{ code: string; detail: string }> = gate.blockers.map((b) => ({
      code: b.code,
      detail: b.detail,
    }));
    if (hubGaps.includes('no_campaign_map')) {
      blockersForWinning.push({ code: 'hub_campaign_map', detail: '0 rows' });
    }
    if (proposalGaps.includes('totals_zero')) {
      blockersForWinning.push({
        code: 'proposal_totals_zero',
        detail: 'drafts may be 0₫ until lines priced',
      });
    }

    const presales: CrmPresalesPack = {
      lead: {
        id: lead?.id ?? leadId,
        name: lead?.full_name ?? '',
        status: lead?.status ?? '',
        source: lead?.source ?? '',
        owner: lead?.owner_name ?? '',
        created_at: lead?.created_at ?? '',
      },
      bant: {
        session_id: intake?.id ?? null,
        score: intake ? `${intake.bant_total}/30` : '0/30',
        decision: decisionLabel(intake?.decision ?? ''),
        completed_at: intake?.completed_at ?? '',
        discovery_answered: intake ? discoveryAnswered(intake.answers_json) : '0/12',
        red_flags: intake ? redFlagCount(intake.answers_json) : 0,
        sync_ok: sync.sync_ok,
        sync_issues: sync.sync_issues,
      },
      tmmt: {
        lifecycle_id: lifecycle?.id ?? null,
        progress: `${filled}/12`,
        gate_passed: tmmtValidation.ok,
        missing_fields: missing.length
          ? missing
          : tmmtValidation.messages.map((m) => m.slice(0, 80)),
        audience_bullets: [
          target_market_prof.segmentation_icp,
          target_market_prof.personas_roles,
        ].filter((x) => String(x ?? '').trim()),
        channels: String(strategy_framework.media_reach ?? '')
          .split(/[,;|]/)
          .map((x) => x.trim())
          .filter(Boolean),
        core_message: String(strategy_framework.market_message ?? '').trim(),
        suggested_am: amName,
        suggested_sp: spName,
        geography_resolved: geographyResolved,
      },
      l2_ads: {
        ads_account_readable: adsReadable == null ? null : Boolean(adsReadable),
        pixel_capi: pixel == null ? null : Boolean(pixel),
        landing_page_url: String(l2.landing_page_url ?? l2.landing ?? '').trim(),
        historical_spend_available: l2.historical_spend == null ? null : Boolean(l2.historical_spend),
        gaps: l2Gaps,
      },
      contract: {
        id: contract?.id ?? null,
        title: contract?.title ?? '',
        value_vnd: contract != null ? contract.amount_vnd : null,
        value_meaning: 'contract_total_unspecified_media_vs_fee_split',
      },
      proposal: {
        ids: proposals.map((p) => p.id),
        qt_codes_found: qtCodes,
        has_positive_total: positiveProposals.length > 0,
        kpi_contract_score: 0,
        gaps: proposalGaps,
      },
      insight: {
        approved_count: approvedIds.length,
        approved_ids: approvedIds,
        can_insert_into_plan: approvedIds.length > 0,
      },
      hub_agency: {
        client_key: client?.code ?? '',
        client_id: client?.id ?? '',
        campaign_map_rows: hubMaps,
        launch_qa_skipped: hubMaps === 0,
        gaps: hubGaps,
      },
    };

    return {
      ok: true,
      wired: true,
      phase: 'P6',
      source: 'ptt-crm',
      as_of: new Date().toISOString(),
      tool: 'presales.context.read',
      client: {
        id: client?.id ?? '',
        name: client?.name ?? '',
        lifecycle: lifecycle?.stage ?? client?.status ?? '',
      },
      presales,
      known,
      assumed,
      unknown,
      blockers_for_winning_plan: blockersForWinning,
      links: [...new Set([...links, ...gate.links])],
    };
  }

  /** Snapshot used by WinningPlanGate enforcement. */
  async evaluateGateForIds(input: {
    lifecycle_id?: number | null;
    plan_id?: number | null;
    lead_id?: number | null;
    client_id?: string | null;
  }) {
    const pack = await this.buildPack({
      lifecycle_id: input.lifecycle_id ?? undefined,
      plan_id: input.plan_id ?? undefined,
      lead_id: input.lead_id ?? undefined,
      client_id: input.client_id ?? undefined,
    });
    return evaluateWinningPlanGate(
      {
        tmmt_gate_passed: pack.presales.tmmt.gate_passed,
        tmmt_progress: pack.presales.tmmt.progress,
        approved_insight_count: pack.presales.insight.approved_count,
        geography_resolved: pack.presales.tmmt.geography_resolved,
      },
      {
        lifecycle_id: pack.presales.tmmt.lifecycle_id,
        plan_id: positiveInt(input.plan_id) ?? null,
      },
    );
  }

  private parseInput(input: Record<string, unknown>): PresalesContextInput {
    const client_id = String(input.client_id ?? input.clientId ?? '').trim() || undefined;
    const lifecycle_id = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    const plan_id = positiveInt(input.plan_id ?? input.planId);
    const lead_id = positiveInt(input.lead_id ?? input.leadId);
    if (!client_id && !lifecycle_id && !plan_id && !lead_id) {
      throw new BadRequestException({
        error: 'context_id_required',
        message: 'Provide lifecycle_id, lead_id, plan_id, or client_id',
      });
    }
    return { client_id, lifecycle_id, plan_id, lead_id };
  }
}
