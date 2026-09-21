import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import {
  confirmFieldMeta,
  readP8QualityFromForms,
  writeP8QualityPatch,
} from './ops-p8-quality-state.util';
import type { FieldQualityMeta, FieldQualityStatus } from './ops-field-quality.util';
import type { ConfirmAssumedResult } from './ops-presales-p8.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trimSku(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .slice(0, 80);
}

@Injectable()
export class OpsFieldConfirmService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async confirm(
    input: Record<string, unknown>,
    actor: string,
  ): Promise<ConfirmAssumedResult> {
    const leadId = positiveInt(input.lead_id ?? input.leadId);
    let lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null && leadId != null) {
      lifecycleId = (await this.repo.findLifecycleByLead(leadId))?.id;
    }
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_id_required' });
    }
    const field = String(input.field ?? '').trim();
    const action = String(input.action ?? 'confirm_assumed').trim();

    const lifecycle = await this.repo.getLifecycleDetail(lifecycleId);
    if (!lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const leadTask = await this.repo.getStageTask(lifecycleId, 'lead');
    const consultTask = await this.repo.ensureStageTask(lifecycleId, 'consult');
    const target = consultTask;

    const quality = readP8QualityFromForms({
      leadForm: leadTask?.form_data,
      consultForm: consultTask.form_data,
    });

    if (field === 'service') {
      return this.confirmService(input, actor, lifecycleId, target, quality);
    }

    const tmmtCoreKeys = new Set([
      'market_context',
      'segmentation_icp',
      'personas_roles',
      'pains_desired_outcomes',
    ]);
    if (tmmtCoreKeys.has(field)) {
      return this.confirmTmmtCore(input, actor, lifecycle, field, quality);
    }

    let nextStatus: Extract<FieldQualityStatus, 'assumed_confirmed' | 'validated' | 'empty'>;
    if (action === 'validate_customer' || action === 'khach_xac_nhan') {
      nextStatus = 'validated';
    } else if (action === 'reject' || action === 'return_am') {
      nextStatus = 'empty';
    } else {
      nextStatus = 'assumed_confirmed';
    }

    const current =
      field === 'icp' || field === 'target_audience' ? quality.icp : quality.need_pain;
    let meta = confirmFieldMeta(current, nextStatus, actor);
    if (action === 'reject') {
      // Keep draft text visible but gate-ignored until re-confirmed.
      meta = {
        ...current,
        status: 'assumed_draft',
        confirmed_by: actor,
        confirmed_at: new Date().toISOString(),
      };
    }

    const patched = writeP8QualityPatch({
      form: target.form_data,
      ...(field === 'icp' || field === 'target_audience'
        ? { icp: meta }
        : { need_pain: meta }),
      clear_rework: nextStatus === 'assumed_confirmed' || nextStatus === 'validated',
    });
    await this.repo.patchStageTaskFormData(target.id, patched);

    if (field === 'need_pain' || field === 'pain') {
      const intake = await this.repo.getLatestCompletedIntake(lifecycle.lead_id, lifecycleId);
      if (intake) {
        await this.repo.patchIntakeAnswersMeta(intake.id, {
          pain_summary: meta.text,
          pain_quality: meta,
        });
      }
    }

    // Sync Confirm onto official TMMT core field meta (WinningPlanGate core_unconfirmed).
    await this.syncTmmtCoreQuality(lifecycle.marketing_plan_id, field, meta);

    return {
      ok: true,
      phase: 'P8',
      field: field === 'target_audience' ? 'icp' : field === 'pain' ? 'need_pain' : field,
      status: meta.status,
      meta,
    };
  }

  private async confirmTmmtCore(
    input: Record<string, unknown>,
    actor: string,
    lifecycle: { id?: number; marketing_plan_id?: number | null },
    field: string,
    quality?: ReturnType<typeof readP8QualityFromForms>,
  ): Promise<ConfirmAssumedResult> {
    const action = String(input.action ?? 'confirm_assumed').trim();
    let nextStatus: Extract<FieldQualityStatus, 'assumed_confirmed' | 'validated' | 'empty'>;
    if (action === 'validate_customer' || action === 'khach_xac_nhan') {
      nextStatus = 'validated';
    } else if (action === 'reject' || action === 'return_am') {
      nextStatus = 'empty';
    } else {
      nextStatus = 'assumed_confirmed';
    }

    const planId = lifecycle.marketing_plan_id;
    if (planId == null || planId <= 0) {
      throw new NotFoundException({ error: 'official_plan_missing' });
    }
    const plan = await this.repo.getOfficialPlan(planId);
    if (!plan) {
      throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
    }
    const { strategy_framework, target_market_prof } = this.repo.parseOfficialPlan(plan);
    let fieldMeta: Record<string, unknown> = {};
    const raw = strategy_framework.ai_tmmt_field_meta;
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') fieldMeta = { ...(parsed as Record<string, unknown>) };
      } catch {
        fieldMeta = {};
      }
    }
    const existing =
      fieldMeta[field] && typeof fieldMeta[field] === 'object'
        ? (fieldMeta[field] as FieldQualityMeta)
        : ({ status: 'assumed_draft' } as FieldQualityMeta);
    const consultText =
      field === 'pains_desired_outcomes'
        ? String(quality?.need_pain?.text ?? '').trim()
        : field === 'segmentation_icp'
          ? String(quality?.icp?.text ?? '').trim()
          : '';
    const text =
      String(existing.text ?? existing.value ?? '').trim() ||
      String(target_market_prof[field] ?? '').trim() ||
      consultText;
    if (text && !String(target_market_prof[field] ?? '').trim()) {
      target_market_prof[field] = text.slice(0, 4000);
    }
    let meta = confirmFieldMeta({ ...existing, text }, nextStatus, actor);
    if (action === 'reject') {
      meta = {
        ...existing,
        text,
        value: text,
        status: 'assumed_draft',
        confirmed_by: actor,
        confirmed_at: new Date().toISOString(),
        lifecycle_id: lifecycle.id,
      };
    } else {
      meta = {
        ...meta,
        text,
        value: text,
        lifecycle_id: lifecycle.id,
      };
    }
    fieldMeta[field] = {
      ...meta,
      ai_draft: meta.status === 'assumed_draft',
    };
    strategy_framework.ai_tmmt_field_meta = JSON.stringify(fieldMeta) as unknown as string;
    await this.repo.patchOfficialPlanContent(planId, {
      target_market_prof,
      strategy_framework,
    });
    return {
      ok: true,
      phase: 'P8',
      field,
      status: meta.status,
      meta,
    };
  }

  private async syncTmmtCoreQuality(
    planId: number | null | undefined,
    field: string,
    meta: FieldQualityMeta,
  ): Promise<void> {
    if (planId == null || planId <= 0) return;
    const tmmtKey =
      field === 'icp' || field === 'target_audience'
        ? 'segmentation_icp'
        : field === 'need_pain' || field === 'pain'
          ? 'pains_desired_outcomes'
          : null;
    if (!tmmtKey) return;

    const plan = await this.repo.getOfficialPlan(planId);
    if (!plan) return;
    const { strategy_framework, target_market_prof } = this.repo.parseOfficialPlan(plan);
    let fieldMeta: Record<string, unknown> = {};
    const raw = strategy_framework.ai_tmmt_field_meta;
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') fieldMeta = { ...(parsed as Record<string, unknown>) };
      } catch {
        fieldMeta = {};
      }
    }
    const text =
      String(meta.text ?? '').trim() || String(target_market_prof[tmmtKey] ?? '').trim();
    if (text && !String(target_market_prof[tmmtKey] ?? '').trim()) {
      target_market_prof[tmmtKey] = text.slice(0, 4000);
    }
    fieldMeta[tmmtKey] = {
      ...(typeof fieldMeta[tmmtKey] === 'object' && fieldMeta[tmmtKey]
        ? (fieldMeta[tmmtKey] as Record<string, unknown>)
        : {}),
      status: meta.status,
      source: meta.source ?? 'am_confirm',
      confidence: meta.confidence,
      text: text || undefined,
      confirmed_by: meta.confirmed_by ?? null,
      confirmed_at: meta.confirmed_at ?? null,
      ai_draft: meta.status === 'assumed_draft',
    };
    strategy_framework.ai_tmmt_field_meta = JSON.stringify(fieldMeta) as unknown as string;
    await this.repo.patchOfficialPlanContent(planId, {
      target_market_prof,
      strategy_framework,
    });
  }

  private async confirmService(
    input: Record<string, unknown>,
    actor: string,
    lifecycleId: number,
    target: { id: number; form_data: Record<string, unknown> },
    quality: ReturnType<typeof readP8QualityFromForms>,
  ): Promise<ConfirmAssumedResult> {
    const action = String(input.action ?? 'confirm_assumed').trim();
    let serviceStatus = quality.service_status;
    if (action === 'reject') {
      serviceStatus = 'recommended_draft';
    } else if (action === 'select' || input.select === true) {
      serviceStatus = 'selected';
    } else {
      serviceStatus = 'recommended_confirmed';
    }

    const lifecycle = await this.repo.getLifecycleDetail(lifecycleId);
    const primarySku =
      trimSku(input.sku) ||
      trimSku(
        (quality.service_recommendation as { primary?: { sku?: string } } | undefined)?.primary
          ?.sku,
      ) ||
      lifecycle?.service_slug ||
      '';

    if (
      (serviceStatus === 'selected' || serviceStatus === 'recommended_confirmed') &&
      primarySku
    ) {
      await this.repo.patchLifecycleServiceSlug(lifecycleId, primarySku);
    }

    const patched = writeP8QualityPatch({
      form: target.form_data,
      service_status: serviceStatus,
      clear_rework:
        serviceStatus === 'selected' || serviceStatus === 'recommended_confirmed',
    });
    await this.repo.patchStageTaskFormData(target.id, patched);

    return {
      ok: true,
      phase: 'P8',
      field: 'service',
      status:
        serviceStatus === 'selected' || serviceStatus === 'recommended_confirmed'
          ? 'assumed_confirmed'
          : 'assumed_draft',
      meta: {
        status:
          serviceStatus === 'selected' || serviceStatus === 'recommended_confirmed'
            ? 'assumed_confirmed'
            : 'assumed_draft',
        source: 'am_confirm',
        confirmed_by: actor,
        confirmed_at: new Date().toISOString(),
        text: primarySku,
      },
    };
  }
}
