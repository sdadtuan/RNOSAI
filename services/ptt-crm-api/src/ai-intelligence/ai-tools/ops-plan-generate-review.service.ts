import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { OpsPresalesContextService } from './ops-presales-context.service';
import { parsePlanContent } from '../../service-lifecycle/lifecycle-marketing-plan.util';
import type { PlanGenerateReviewResult } from './ops-presales-p7.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 4000): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function maskPii(text: string): string {
  return text
    .replace(/\b0\d{9,10}\b/g, '[phone]')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '[email]');
}

@Injectable()
export class OpsPlanGenerateReviewService {
  constructor(
    private readonly repo: OpsPresalesContextRepository,
    private readonly presales: OpsPresalesContextService,
  ) {}

  async generateReview(
    input: Record<string, unknown>,
    actor: string,
  ): Promise<PlanGenerateReviewResult> {
    const lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    const cloneFrom = positiveInt(input.clone_from_plan_id ?? input.cloneFromPlanId);
    const explicitPlanId = positiveInt(input.plan_id ?? input.planId);
    const supersede = Boolean(input.supersede);

    if (lifecycleId == null && cloneFrom == null && explicitPlanId == null) {
      throw new BadRequestException({ error: 'lifecycle_id_or_plan_id_required' });
    }

    const pack = await this.presales.buildPack({
      lifecycle_id: lifecycleId,
      plan_id: cloneFrom ?? explicitPlanId,
      lead_id: positiveInt(input.lead_id ?? input.leadId),
      client_id: trim(input.client_id ?? input.clientId) || undefined,
    });

    const gateBlockers = pack.blockers_for_winning_plan ?? [];
    const gatePassed = gateBlockers.filter((b) =>
      ['tmmt_gate', 'no_approved_insight', 'geography_missing'].includes(b.code),
    ).length === 0;

    if (explicitPlanId != null) {
      const status = await this.repo.getPlanStatus(explicitPlanId);
      if (status === 'active' && !supersede) {
        throw new ConflictException({
          error: 'active_plan_not_patched',
          plan_id: explicitPlanId,
          message: 'Will not silent-patch active plan; pass supersede=true or omit plan_id',
        });
      }
    }

    const tmmt = pack.presales.tmmt;
    const bant = pack.presales.bant;
    const contract = pack.presales.contract;
    const clientName = pack.client.name || pack.presales.lead.name || 'Client';
    const title =
      trim(input.title) ||
      `${clientName} — Plan review từ presales`.slice(0, 400);

    const known = pack.known ?? [];
    const assumed = pack.assumed ?? [];
    const unknown = pack.unknown ?? [];

    const execSummary = maskPii(
      [
        `Executive summary (P7 review): ${clientName}.`,
        `BANT ${bant.score} · ${bant.decision}. TMMT ${tmmt.progress} (gate_passed=${tmmt.gate_passed}).`,
        tmmt.core_message ? `Message: ${tmmt.core_message}` : 'Message: unknown',
        contract.value_vnd != null
          ? `HĐ value ${contract.value_vnd}₫ — media vs fee split UNKNOWN (do not invent).`
          : 'Contract value unknown.',
      ].join('\n'),
    );

    const objectives = maskPii(
      [
        '1) Validate ICP / geo / pains from TMMT before scale.',
        '2) Confirm KPI evidence from L2 / history with AM.',
        '3) CEO/CMO approve review → active; then breakdown_to_roles.',
        ...tmmt.audience_bullets.slice(0, 4),
      ].join('\n'),
    );

    const calendar = [
      'D0–D14: Kickoff, pixel/CAPI, landing QA',
      'D15–D45: Creative tests on TMMT channels',
      'D46–D90: Scale winners only after gate pass',
    ].join('\n');

    const channelMix = tmmt.channels.length
      ? tmmt.channels.map((c) => `- ${c}: from TMMT media_reach`).join('\n')
      : '- Channel mix unknown — complete TMMT media_reach';

    const blockersText = gateBlockers
      .map((b) => `- ${b.code}: ${b.detail || '—'}`)
      .join('\n');

    const notes = maskPii(
      [
        '=== Known ===',
        ...known.map((k) => `- ${k}`),
        '=== Assumed ===',
        ...assumed.map((a) => `- ${a}`),
        '=== Unknown ===',
        ...unknown.map((u) => `- ${u}`),
        '=== Channel mix ===',
        channelMix,
        '=== 90-day calendar ===',
        calendar,
        '=== Role KPI preview (not persisted) ===',
        '- AM: CPL / lead quality',
        '- Ads: CTR / CPA (needs L2 evidence)',
        '- Content: assets shipped',
        '=== WinningPlanGate blockers (soft-allow review) ===',
        blockersText || '- none',
        `=== Audit ===`,
        `[AI draft] marketing_plan.generate_review by ${actor} at ${new Date().toISOString()}`,
      ].join('\n'),
    );

    const clonePlan =
      cloneFrom != null ? await this.repo.getOfficialPlan(cloneFrom) : null;
    const cloneParsed = parsePlanContent(
      clonePlan
        ? {
            strategy_framework_json: clonePlan.strategy_framework_json,
            target_market_prof_json: clonePlan.target_market_prof_json,
          }
        : null,
    );

    const target_market_prof: Record<string, unknown> = {
      ...cloneParsed.target_market_prof,
    };
    if (
      tmmt.audience_bullets[0] &&
      !String(target_market_prof.segmentation_icp ?? '').trim()
    ) {
      target_market_prof.segmentation_icp = tmmt.audience_bullets[0];
    }
    if (
      tmmt.audience_bullets[1] &&
      !String(target_market_prof.personas_roles ?? '').trim()
    ) {
      target_market_prof.personas_roles = tmmt.audience_bullets[1];
    }
    if (!String(target_market_prof.geo_behavior ?? '').trim()) {
      target_market_prof.geo_behavior = tmmt.geography_resolved
        ? 'Geography resolved (see TMMT)'
        : 'Geography missing — blocker';
    }

    const strategy_framework: Record<string, unknown> = {
      ...cloneParsed.strategy_framework,
    };
    if (tmmt.core_message && !String(strategy_framework.market_message ?? '').trim()) {
      strategy_framework.market_message = tmmt.core_message;
    }
    if (tmmt.channels.length && !String(strategy_framework.media_reach ?? '').trim()) {
      strategy_framework.media_reach = tmmt.channels.join(', ');
    }
    strategy_framework.ai_draft = {
      tool: 'marketing_plan.generate_review',
      actor,
      filled_at: new Date().toISOString(),
      gate_passed: gatePassed,
    };

    const planId = await this.repo.insertPlanReview({
      name: title,
      period_label: '90d-review',
      objectives: `${execSummary}\n\n${objectives}`.slice(0, 32000),
      notes: notes.slice(0, 32000),
      lifecycle_id: tmmt.lifecycle_id ?? lifecycleId ?? null,
      north_star: trim(tmmt.core_message, 500) || `Review plan for ${clientName}`,
      strategy_framework_json: strategy_framework,
      target_market_prof_json: target_market_prof,
    });

    if (!planId) {
      throw new NotFoundException({ error: 'plan_create_failed' });
    }

    return {
      ok: true,
      plan_id: planId,
      status: 'review',
      phase: 'P7',
      gate_snapshot: {
        passed: gatePassed,
        blockers: gateBlockers,
      },
      links: [`/crm/marketing-plan/${planId}`],
    };
  }
}
