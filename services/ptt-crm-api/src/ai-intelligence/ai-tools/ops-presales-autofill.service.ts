import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceLifecycleService } from '../../service-lifecycle/service-lifecycle.service';
import {
  OFFICIAL_TMMT_CORE_KEYS,
  TARGET_MARKET_PROF_KEYS,
  parsePlanContent,
  validateOfficialTmmt,
} from '../../service-lifecycle/lifecycle-marketing-plan.util';
import { buildOfficialTmmtSeedFromConsult } from '../../service-lifecycle/lifecycle-tmmt-seed.util';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { OpsPresalesContextService } from './ops-presales-context.service';
import { readP8QualityFromForms } from './ops-p8-quality-state.util';
import type {
  AutofillFieldSkipped,
  AutofillFieldWritten,
  PresalesAutofillResult,
  TmmtOverwriteMode,
} from './ops-presales-p7.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 800): string {
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
export class OpsPresalesAutofillService {
  constructor(
    private readonly repo: OpsPresalesContextRepository,
    private readonly presales: OpsPresalesContextService,
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  async autofill(input: Record<string, unknown>): Promise<PresalesAutofillResult> {
    const lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_id_required' });
    }
    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const mode = this.parseMode(input.overwrite_mode ?? input.overwriteMode);
    const leadId = positiveInt(input.lead_id ?? input.leadId);

    const lifecycle = await this.repo.getLifecycleDetail(lifecycleId);
    if (!lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }
    const planId = lifecycle.marketing_plan_id;
    if (planId == null) {
      throw new NotFoundException({ error: 'official_plan_missing', lifecycle_id: lifecycleId });
    }

    const plan = await this.repo.getOfficialPlan(planId);
    if (!plan) {
      throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
    }

    const { strategy_framework: existingSf, target_market_prof: existingProf } =
      parsePlanContent(plan);
    const beforeFilled = TARGET_MARKET_PROF_KEYS.filter((k) =>
      String(existingProf[k] ?? '').trim(),
    ).length;

    const consultBrief = await this.lifecycle.consultBrief(lifecycleId);
    const overwrite = mode === 'merge_prefer_presales' || mode === 'replace_all_ai';
    const seed = buildOfficialTmmtSeedFromConsult({
      consultBrief,
      existingProf,
      existingSf,
      overwrite: mode === 'merge_prefer_presales',
    });

    // P8 — after Confirm Assumed, force-map Đối tượng mục tiêu → ICP and Need/Pain → pains
    // even if seed missed them (empty_source).
    const leadTask = await this.repo.getStageTask(lifecycleId, 'lead');
    const consultTask = await this.repo.getStageTask(lifecycleId, 'consult');
    const intake = await this.repo.getLatestCompletedIntake(
      leadId ?? lifecycle.lead_id,
      lifecycleId,
    );
    const intakeMeta =
      intake?.answers_json?.meta && typeof intake.answers_json.meta === 'object'
        ? (intake.answers_json.meta as Record<string, unknown>)
        : {};
    const quality = readP8QualityFromForms({
      leadForm: leadTask?.form_data,
      consultForm: consultTask?.form_data,
      intakeMeta,
    });
    const icpText = trim(quality.icp.text);
    const painText = trim(quality.need_pain.text);
    if (icpText) {
      seed.target_market_prof.segmentation_icp = icpText;
    }
    if (painText) {
      const goal = trim((consultBrief.highlights as Record<string, unknown> | undefined)?.goal);
      seed.target_market_prof.pains_desired_outcomes = goal
        ? `${painText}${painText.includes('→') ? '' : ` → Mong muốn: ${goal}`}`
        : painText;
    }

    // replace_all_ai: only overwrite keys that already have ai meta (or empty).
    const fieldMeta = this.readFieldMeta(existingSf);
    const nextProf = { ...existingProf };
    const nextSf = { ...existingSf };
    const written: AutofillFieldWritten[] = [];
    const skipped: AutofillFieldSkipped[] = [];
    const known: string[] = [];
    const assumed: string[] = [];
    const unknown: string[] = [];

    for (const key of TARGET_MARKET_PROF_KEYS) {
      const proposed = trim(seed.target_market_prof[key]);
      const current = trim(nextProf[key]);
      if (!proposed) {
        if (!current) {
          skipped.push({ key, reason: 'empty_source' });
          unknown.push(key);
        }
        continue;
      }
      if (mode === 'fill_empty_only' && current) {
        skipped.push({ key, reason: 'human_or_existing_value' });
        known.push(`${key}=existing`);
        continue;
      }
      if (mode === 'replace_all_ai' && current && !fieldMeta[key]?.ai_draft) {
        skipped.push({ key, reason: 'human_locked' });
        continue;
      }
      if (current === proposed) {
        skipped.push({ key, reason: 'unchanged' });
        continue;
      }
      nextProf[key] = maskPii(proposed);
      const source = this.inferSource(key, consultBrief);
      const confidence = source === 'consult' ? 0.82 : source === 'bant' ? 0.75 : 0.6;
      written.push({ key, source, confidence });
      fieldMeta[key] = {
        ai_draft: true,
        source,
        confidence,
        filled_at: new Date().toISOString(),
      };
      known.push(`${key}←${source}`);
    }

    for (const key of Object.keys(seed.strategy_framework)) {
      const proposed = trim(seed.strategy_framework[key]);
      const current = trim(nextSf[key]);
      if (!proposed) continue;
      if (mode === 'fill_empty_only' && current) continue;
      if (mode === 'replace_all_ai' && current && !fieldMeta[`sf:${key}`]?.ai_draft) continue;
      if (current === proposed) continue;
      nextSf[key] = maskPii(proposed);
      written.push({ key: `sf:${key}`, source: 'consult', confidence: 0.7 });
      fieldMeta[`sf:${key}`] = {
        ai_draft: true,
        source: 'consult',
        confidence: 0.7,
        filled_at: new Date().toISOString(),
      };
    }

    // Contract / L2 soft enrich (never invent media split).
    const pack = await this.presales.buildPack({
      lifecycle_id: lifecycleId,
      lead_id: leadId ?? lifecycle.lead_id ?? undefined,
      plan_id: planId,
    });
    const contractTitle = trim(pack.presales.contract.title);
    if (contractTitle && !trim(nextProf.market_context)) {
      if (mode === 'fill_empty_only' || !trim(nextProf.market_context)) {
        nextProf.market_context = maskPii(`HĐ: ${contractTitle}`);
        written.push({ key: 'market_context', source: 'contract', confidence: 0.7 });
        fieldMeta.market_context = {
          ai_draft: true,
          source: 'contract',
          confidence: 0.7,
          filled_at: new Date().toISOString(),
        };
      }
    } else if (!trim(nextProf.market_context)) {
      skipped.push({ key: 'market_context', reason: 'empty_source' });
    }

    const valueVnd = pack.presales.contract.value_vnd;
    if (valueVnd != null && valueVnd > 0) {
      assumed.push(
        `contract_value_vnd=${valueVnd}; media_vs_fee_split_unspecified`,
      );
    }

    const afterFilled = TARGET_MARKET_PROF_KEYS.filter((k) => String(nextProf[k] ?? '').trim())
      .length;
    const validationPlan = {
      ...plan,
      target_market_prof_json: nextProf,
      strategy_framework_json: nextSf,
    };
    const validation = validateOfficialTmmt(validationPlan);
    const missingRequired: string[] = OFFICIAL_TMMT_CORE_KEYS.filter((k) => !trim(nextProf[k]));
    if (!trim(nextProf.geo_behavior)) missingRequired.push('geo_behavior');

    if (!dryRun && written.length) {
      nextSf.ai_tmmt_field_meta = JSON.stringify(fieldMeta) as unknown as string;
      nextSf.ai_draft = JSON.stringify({
        tool: 'presales.autofill_tmmt',
        filled_at: new Date().toISOString(),
        mode,
      }) as unknown as string;
      await this.repo.patchOfficialPlanContent(planId, {
        target_market_prof: nextProf,
        strategy_framework: nextSf,
      });
    }

    const readiness = Math.min(
      95,
      Math.round((afterFilled / TARGET_MARKET_PROF_KEYS.length) * 100),
    );

    return {
      ok: true,
      wired: true,
      phase: 'P7',
      lifecycle_id: lifecycleId,
      dry_run: dryRun,
      fields_written: written,
      fields_skipped: skipped,
      tmmt_progress: {
        before: `${beforeFilled}/${TARGET_MARKET_PROF_KEYS.length}`,
        after: `${afterFilled}/${TARGET_MARKET_PROF_KEYS.length}`,
      },
      gate_passed: validation.ok && missingRequired.length === 0,
      missing_required: [...new Set(missingRequired)],
      ai_planner_readiness_hint: readiness,
      links: [`/crm/service-delivery/${lifecycleId}?tab=tmmt`],
      known,
      assumed,
      unknown,
    };
  }

  private parseMode(raw: unknown): TmmtOverwriteMode {
    const mode = String(raw ?? 'fill_empty_only').trim();
    if (mode === 'merge_prefer_presales' || mode === 'replace_all_ai') return mode;
    return 'fill_empty_only';
  }

  private readFieldMeta(
    sf: Record<string, string>,
  ): Record<string, { ai_draft: boolean; source: string; confidence: number; filled_at: string }> {
    const raw = sf.ai_tmmt_field_meta;
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<
          string,
          { ai_draft: boolean; source: string; confidence: number; filled_at: string }
        >;
      }
    } catch {
      /* ignore */
    }
    return {};
  }

  private inferSource(key: string, brief: Record<string, unknown>): string {
    const highlights = (brief.highlights ?? {}) as Record<string, unknown>;
    if (key === 'pains_desired_outcomes' && trim(highlights.pain)) return 'consult';
    if (
      key === 'segmentation_icp' &&
      (trim(highlights.target_audience) || trim(highlights.niche) || trim(highlights.domain))
    ) {
      return 'consult';
    }
    if (key === 'segmentation_icp') return 'consult';
    if (key === 'pains_desired_outcomes') return 'consult';
    if (key === 'insights_evidence') return 'bant';
    if (key === 'geo_behavior') return 'consult';
    return 'consult';
  }
}
