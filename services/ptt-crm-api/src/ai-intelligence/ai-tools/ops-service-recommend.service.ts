import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SERVICE_LABELS } from '../../leads-contract/lifecycle-workflow-steps.util';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { readP8QualityFromForms, writeP8QualityPatch } from './ops-p8-quality-state.util';
import type { ServiceRecommendItem, ServiceRecommendResult } from './ops-presales-p8.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 400): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

const MENU: ServiceRecommendItem[] = [
  {
    sku: 'quang-cao-facebook',
    label: SERVICE_LABELS['quang-cao-facebook'] ?? 'Facebook Ads',
    reason: 'Lead gen / awareness khi KH có audience social rõ',
    when_to_pick: 'Cần lead nhanh, visual product, retargeting',
  },
  {
    sku: 'quang-cao-google',
    label: SERVICE_LABELS['quang-cao-google'] ?? 'Google Ads',
    reason: 'Intent search cao — KH đang tìm giải pháp',
    when_to_pick: 'Có từ khóa / demand search rõ',
  },
  {
    sku: 'dich-vu-seo-tong-the',
    label: SERVICE_LABELS['dich-vu-seo-tong-the'] ?? 'SEO Tổng thể',
    reason: 'Xây organic dài hạn khi domain/content sẵn sàng',
    when_to_pick: 'Có website + chấp nhận 3–6 tháng',
  },
  {
    sku: 'lead-gen',
    label: SERVICE_LABELS['lead-gen'] ?? 'Lead generation',
    reason: 'Gói hỗn hợp ads+landing khi chưa chọn kênh',
    when_to_pick: 'Chưa chắc kênh, cần pipeline thử nghiệm',
  },
  {
    sku: 'thiet-ke-landing-page',
    label: SERVICE_LABELS['thiet-ke-landing-page'] ?? 'Landing Page',
    reason: 'Thiếu LP chuyển đổi trước khi scale ads',
    when_to_pick: 'Traffic có nhưng CVR thấp / chưa có LP',
  },
];

@Injectable()
export class OpsServiceRecommendService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async recommend(input: Record<string, unknown>): Promise<ServiceRecommendResult> {
    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const leadId = positiveInt(input.lead_id ?? input.leadId);
    let lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null && leadId != null) {
      const lc = await this.repo.findLifecycleByLead(leadId);
      lifecycleId = lc?.id;
    }
    if (lifecycleId == null && leadId == null) {
      throw new BadRequestException({ error: 'lead_or_lifecycle_required' });
    }

    const lifecycle = lifecycleId != null ? await this.repo.getLifecycleDetail(lifecycleId) : null;
    if (lifecycleId != null && !lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const signals = (input.signals ?? {}) as Record<string, unknown>;
    const industry = trim(signals.industry);
    const utterance = trim(signals.customer_utterance, 800).toLowerCase();
    const useCrm = signals.use_crm_similar_cases !== false;
    const useWeb = signals.use_web_research !== false;

    const leadForm =
      lifecycleId != null ? (await this.repo.getStageTask(lifecycleId, 'lead'))?.form_data : null;
    const consultTask =
      lifecycleId != null ? await this.repo.getStageTask(lifecycleId, 'consult') : null;
    const quality = readP8QualityFromForms({
      leadForm,
      consultForm: consultTask?.form_data,
    });

    const niche = industry || trim(leadForm?.niche ?? leadForm?.industry);
    const weak =
      !niche &&
      !utterance &&
      !trim(lifecycle?.service_slug) &&
      quality.service_status === 'unknown';

    if (weak) {
      return {
        ok: true,
        phase: 'P8',
        service_status: 'unknown',
        primary: null,
        alternate: null,
        menu: MENU.slice(0, 5),
        confidence: 0.2,
        citations: [],
        links: lifecycleId
          ? [`/crm/service-delivery/${lifecycleId}`]
          : leadId
            ? [`/crm/leads/${leadId}`]
            : [],
        return_to_am: true,
        blockers: ['need_industry_or_intent'],
      };
    }

    const scored = this.scoreMenu({ niche, utterance, existingSlug: trim(lifecycle?.service_slug) });
    const primary = scored[0] ?? null;
    const alternate = scored[1] ?? null;
    const confidence = primary ? Math.min(0.92, 0.55 + (niche ? 0.15 : 0) + (utterance ? 0.1 : 0)) : 0.3;
    const citations: string[] = [];
    if (useCrm && niche) citations.push(`crm:similar:${niche.slice(0, 40)}`);
    if (useWeb && niche) citations.push(`web:industry:${niche.slice(0, 40)}`);
    if (utterance) citations.push('utterance:customer');

    const recommendation = {
      primary,
      alternate,
      menu: scored.slice(0, 5),
      confidence,
      citations,
      drafted_at: new Date().toISOString(),
    };

    if (!dryRun && lifecycleId != null) {
      const target = consultTask ?? (await this.repo.getStageTask(lifecycleId, 'lead'));
      if (target) {
        const patched = writeP8QualityPatch({
          form: target.form_data,
          service_status: 'recommended_draft',
          service_recommendation: recommendation,
        });
        await this.repo.patchStageTaskFormData(target.id, patched);
      }
    }

    return {
      ok: true,
      phase: 'P8',
      service_status: 'recommended_draft',
      primary,
      alternate,
      menu: scored.slice(0, 5),
      confidence,
      citations,
      links: lifecycleId
        ? [`/crm/service-delivery/${lifecycleId}`]
        : leadId
          ? [`/crm/leads/${leadId}`]
          : [],
    };
  }

  private scoreMenu(opts: {
    niche: string;
    utterance: string;
    existingSlug: string;
  }): ServiceRecommendItem[] {
    const corpus = `${opts.niche} ${opts.utterance} ${opts.existingSlug}`.toLowerCase();
    const score = (sku: string): number => {
      let s = 1;
      if (opts.existingSlug === sku) s += 5;
      if (/facebook|meta|fb|social|tiktok/.test(corpus) && sku === 'quang-cao-facebook') s += 4;
      if (/google|search|seo intent|cpc/.test(corpus) && sku === 'quang-cao-google') s += 4;
      if (/seo|organic|website|content/.test(corpus) && sku === 'dich-vu-seo-tong-the') s += 4;
      if (/landing|lp|chuyển đổi|cvr/.test(corpus) && sku === 'thiet-ke-landing-page') s += 3;
      if (/lead|pipeline|crm|b2b/.test(corpus) && sku === 'lead-gen') s += 3;
      if (/detailing|spa|clinic|nha khoa|thẩm mỹ|auto/.test(corpus) && sku === 'quang-cao-facebook') {
        s += 2;
      }
      return s;
    };
    return [...MENU]
      .map((item) => ({ ...item, _s: score(item.sku) }))
      .sort((a, b) => b._s - a._s)
      .map(({ _s: _ignored, ...item }) => item);
  }
}
