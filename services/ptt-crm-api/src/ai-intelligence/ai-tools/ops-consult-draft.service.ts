import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceLifecycleService } from '../../service-lifecycle/service-lifecycle.service';
import { evaluateConsultReady } from './ops-consult-ready.util';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { readP8QualityFromForms, writeP8QualityPatch } from './ops-p8-quality-state.util';
import type { ConsultDraftResult } from './ops-presales-p8.types';

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
export class OpsConsultDraftService {
  constructor(
    private readonly repo: OpsPresalesContextRepository,
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  async draftFromResearch(
    input: Record<string, unknown>,
    actor: string,
  ): Promise<ConsultDraftResult> {
    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const overwriteMode = String(input.overwrite_mode ?? input.overwriteMode ?? 'fill_empty_only');
    const fillEmptyOnly = overwriteMode !== 'replace_all_ai';
    const leadId = positiveInt(input.lead_id ?? input.leadId);
    let lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null && leadId != null) {
      lifecycleId = (await this.repo.findLifecycleByLead(leadId))?.id;
    }
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_id_required' });
    }

    const lifecycle = await this.repo.getLifecycleDetail(lifecycleId);
    if (!lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const leadTask = await this.repo.getStageTask(lifecycleId, 'lead');
    // Always persist on Consult task — create if missing (fixes consult_or_lead_task_missing).
    const consultTask = await this.repo.ensureStageTask(lifecycleId, 'consult');
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

    const brief = await this.lifecycle.consultBrief(lifecycleId);
    const highlights = (brief.highlights ?? {}) as Record<string, unknown>;
    const serviceLabel = trim(brief.service_label) || trim(lifecycle.service_slug);
    const niche =
      trim(highlights.niche) ||
      trim(leadTask?.form_data?.niche) ||
      trim(leadTask?.form_data?.industry) ||
      'SME VN';
    const domain = trim(highlights.domain);
    const goal = trim(highlights.goal);
    const existingPain = trim(quality.need_pain.text);
    const existingIcp = trim(quality.icp.text);

    // Never invent fees / contract numbers.
    const painDraft = maskPii(
      [
        'Pain · Context · Desired KPI · Constraints (assumed từ research — chờ AM Confirm):',
        existingPain
          ? `Pain: ${existingPain}`
          : `Pain: ${niche} thiếu pipeline ổn định / CPL cao / báo cáo ads thiếu minh bạch.`,
        domain ? `Context: domain ${domain}; dịch vụ gợi ý ${serviceLabel || 'TBD'}.` : `Context: ngành ${niche}.`,
        goal
          ? `Desired KPI: ${goal}`
          : 'Desired KPI: tăng lead đủ chất lượng; giảm CPL; dashboard minh bạch (TBD số liệu).',
        'Constraints: chưa chốt ngân sách media/fee — không bịa số.',
      ].join('\n'),
    );

    const icpDraft = maskPii(
      existingIcp ||
        [
          `Đối tượng mục tiêu (assumed): doanh nghiệp ${niche}`,
          domain ? `quan tâm ${domain}` : 'đang tìm agency performance',
          serviceLabel ? `phù hợp gói ${serviceLabel}` : '',
          '— Owner/GM + Trưởng MKT; quyết định mua dịch vụ 30–90 ngày.',
        ]
          .filter(Boolean)
          .join(' '),
    );

    const written: ConsultDraftResult['fields_written'] = [];
    const skipped: ConsultDraftResult['fields_skipped'] = [];

    let nextPain = quality.need_pain;
    let nextIcp = quality.icp;

    const canWritePain =
      !fillEmptyOnly ||
      quality.need_pain.status === 'empty' ||
      !existingPain ||
      quality.need_pain.status === 'assumed_draft';
    if (canWritePain) {
      nextPain = {
        status: 'assumed_draft',
        source: 'research+sku',
        confidence: 0.75,
        citations: [
          niche ? `industry:${niche}` : '',
          serviceLabel ? `sku:${lifecycle.service_slug}` : '',
          intake ? `intake:${intake.id}` : '',
        ].filter(Boolean),
        filled_by: actor,
        text: painDraft,
      };
      written.push({
        key: 'need_pain',
        status: 'assumed_draft',
        confidence: 0.75,
        source: 'research+sku',
      });
    } else {
      skipped.push({ key: 'need_pain', reason: 'human_or_existing_value' });
    }

    const canWriteIcp =
      !fillEmptyOnly ||
      quality.icp.status === 'empty' ||
      !existingIcp ||
      quality.icp.status === 'assumed_draft';
    if (canWriteIcp) {
      nextIcp = {
        status: 'assumed_draft',
        source: 'research+crm',
        confidence: 0.72,
        citations: [niche ? `industry:${niche}` : 'crm:similar'].filter(Boolean),
        filled_by: actor,
        text: icpDraft,
      };
      written.push({
        key: 'icp',
        status: 'assumed_draft',
        confidence: 0.72,
        source: 'research+crm',
      });
    } else {
      skipped.push({ key: 'icp', reason: 'human_or_existing_value' });
    }

    if (!dryRun && written.length) {
      const patched = writeP8QualityPatch({
        form: consultTask.form_data,
        need_pain: nextPain,
        icp: nextIcp,
      });
      await this.repo.patchStageTaskFormData(consultTask.id, patched);
      if (intake?.id && written.some((w) => w.key === 'need_pain')) {
        await this.repo.patchIntakeAnswersMeta(intake.id, {
          pain_summary: nextPain.text,
          pain_quality: nextPain,
        });
      }
    }

    const preview = evaluateConsultReady({
      bant_score: intake?.bant_total ?? 0,
      qualify_decision: intake?.decision ?? '',
      session_completed: Boolean(intake),
      pain: nextPain,
      icp: nextIcp,
      service_status: quality.service_status,
      needs_am_rework: quality.needs_am_rework,
    });

    return {
      ok: true,
      phase: 'P8',
      fields_written: written,
      fields_skipped: skipped,
      consult_ready_preview: preview.consult_ready,
      blockers: preview.blockers,
      links: [`/crm/service-delivery/${lifecycleId}`],
      task_id: consultTask.id,
      dry_run: dryRun,
    };
  }
}
