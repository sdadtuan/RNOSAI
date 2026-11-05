import { Injectable } from '@nestjs/common';
import { budgetBandLabel, percentile50, percentile80 } from './service-kpi-benchmark';
import { ServiceKpiRepository } from './service-kpi.repository';

@Injectable()
export class ServiceKpiBenchmarksService {
  constructor(private readonly repo: ServiceKpiRepository) {}

  async upsertFromProjectClose(input: {
    dv_code: string;
    dictionary_id: string;
    industry?: string;
    channel?: string;
    budget_band?: string;
    values: number[];
  }) {
    const p50 = percentile50(input.values);
    if (p50 == null) return null;
    const p80 = percentile80(input.values);
    return this.repo.upsertBenchmark({
      dv_code: input.dv_code,
      dictionary_id: input.dictionary_id,
      industry: input.industry,
      channel: input.channel,
      budget_band: input.budget_band,
      p50,
      p80,
      sample_n: input.values.length,
    });
  }

  async formatHint(input: {
    dv_code: string | null;
    dictionary_id: string;
    industry?: string;
    channel?: string;
    budget_min?: number | null;
    budget_max?: number | null;
  }): Promise<string | null> {
    const dv = String(input.dv_code ?? '').trim();
    if (!dv) return null;
    const industry = input.industry ?? 'real_estate';
    const channel = input.channel ?? 'meta';
    const budgetBand = budgetBandLabel(input.budget_min ?? null, input.budget_max ?? null);
    const row = await this.repo.findBenchmark({
      dv_code: dv,
      dictionary_id: input.dictionary_id,
      industry,
      channel,
      budget_band: budgetBand,
    });
    if (row?.p50 == null) return null;
    const industryLabel = industry === 'real_estate' ? 'BĐS' : industry;
    const channelLabel = channel.charAt(0).toUpperCase() + channel.slice(1);
    const band = budgetBand ? ` ${budgetBand}` : '';
    return `P50 ${input.dictionary_id} ${industryLabel} ${channelLabel}${band} = ${row.p50.toLocaleString('vi-VN')}`;
  }
}
