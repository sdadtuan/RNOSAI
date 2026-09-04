import { Injectable } from '@nestjs/common';
import { KpiHubConnectorRegistry } from '../connectors/kpi-hub-connector.registry';
import { KpiHubAlertEngineService } from '../alerts/kpi-hub-alert-engine.service';
import {
  KPI_HUB_DEMO_FACTS,
  parseHubPeriod,
  periodDates,
  resolveFactValue,
} from '../connectors/kpi-hub-connector.port';
import { KpiHubDictionaryRepository } from '../dictionary/kpi-hub-dictionary.repository';
import { deriveHubStatus, ratioPeriod } from '../kpi-hub-status';
import { KpiHubTargetsService } from '../targets/kpi-hub-targets.service';
import { KpiHubFactsRepository } from './kpi-hub-facts.repository';

const DASHBOARD_CODES = ['SAL_008', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007'] as const;
const FUNNEL_CODES = ['MKT_001', 'MKT_002', 'MKT_007', 'SAL_001', 'SAL_003', 'SAL_WON'] as const;

const KPI_QUERY_DEFS: Record<
  string,
  { entity: string; agg: string; field?: string; filters: Array<{ field: string; op: 'eq' | 'flag' | 'in_period'; value?: string }> }
> = {
  MKT_001: { entity: 'Leads', agg: 'DISTINCT_COUNT', field: 'id', filters: [{ field: 'created_at', op: 'in_period' }] },
  MKT_002: {
    entity: 'Leads',
    agg: 'DISTINCT_COUNT',
    field: 'id',
    filters: [
      { field: 'Is_Valid', op: 'flag', value: 'TRUE' },
      { field: 'created_at', op: 'in_period' },
    ],
  },
  MKT_004: { entity: 'AdInsights', agg: 'SUM', field: 'spend', filters: [{ field: 'date', op: 'in_period' }] },
  MKT_007: {
    entity: 'Leads',
    agg: 'DISTINCT_COUNT',
    field: 'id',
    filters: [
      { field: 'status', op: 'eq', value: 'MQL' },
      { field: 'created_at', op: 'in_period' },
    ],
  },
  SAL_001: {
    entity: 'Leads',
    agg: 'DISTINCT_COUNT',
    field: 'id',
    filters: [
      { field: 'status', op: 'eq', value: 'SQL' },
      { field: 'created_at', op: 'in_period' },
    ],
  },
  SAL_003: {
    entity: 'Leads',
    agg: 'COUNT',
    filters: [
      { field: 'status', op: 'eq', value: 'APPOINTMENT' },
      { field: 'created_at', op: 'in_period' },
    ],
  },
  SAL_008: {
    entity: 'Contracts',
    agg: 'SUM',
    field: 'amount',
    filters: [{ field: 'created_at', op: 'in_period' }],
  },
  SAL_WON: {
    entity: 'Leads',
    agg: 'COUNT',
    filters: [
      { field: 'status', op: 'eq', value: 'WON' },
      { field: 'created_at', op: 'in_period' },
    ],
  },
};

const RATIO_DEFS: Record<string, { numerator: string; denominator: string; blank_if_zero: boolean; as_pct?: boolean }> = {
  MKT_006: { numerator: 'MKT_004', denominator: 'MKT_002', blank_if_zero: true },
  MKT_008: { numerator: 'MKT_007', denominator: 'MKT_002', blank_if_zero: true, as_pct: true },
  SAL_007: { numerator: 'SAL_WON', denominator: 'SAL_001', blank_if_zero: true, as_pct: true },
};

@Injectable()
export class KpiHubFactsService {
  constructor(
    private readonly factsRepo: KpiHubFactsRepository,
    private readonly dictRepo: KpiHubDictionaryRepository,
    private readonly connectors: KpiHubConnectorRegistry,
    private readonly alertEngine: KpiHubAlertEngineService,
    private readonly targets: KpiHubTargetsService,
  ) {}

  async computePeriod(period: string) {
    await this.dictRepo.seedIfEmpty();
    const { periodStart, periodEnd } = periodDates(period);
    const hubPeriod = parseHubPeriod(period);
    const computed = new Map<string, number | null>();
    const connectorEmpty = new Map<string, boolean>();

    const allCodes = [...new Set([...DASHBOARD_CODES, ...FUNNEL_CODES, 'MKT_004'])];

    for (const code of allCodes) {
      if (RATIO_DEFS[code]) continue;
      const def = KPI_QUERY_DEFS[code];
      const dict = await this.dictRepo.getByCode(code);
      if (!def || !dict) continue;

      const result = await this.connectors.query(
        def.entity,
        def.agg,
        def.field,
        def.filters,
        hubPeriod,
      );
      connectorEmpty.set(code, result.value == null || result.value === 0);
      const value = resolveFactValue(code, result.value);
      computed.set(code, value);

      await this.factsRepo.upsert({
        dictionary_id: dict.id,
        period_start: periodStart,
        period_end: periodEnd,
        actual_value: value,
        calculation_status: result.health === 'CONNECTION_ERROR' ? 'FAILED' : value == null ? 'NO_DATA' : 'SUCCESS',
        is_blank: value == null,
      });
    }

    for (const [code, ratioDef] of Object.entries(RATIO_DEFS)) {
      const dict = await this.dictRepo.getByCode(code);
      if (!dict) continue;

      let num = computed.get(ratioDef.numerator);
      let den = computed.get(ratioDef.denominator);
      if (num == null) num = resolveFactValue(ratioDef.numerator, null);
      if (den == null) den = resolveFactValue(ratioDef.denominator, null);

      const numEmpty = connectorEmpty.get(ratioDef.numerator) ?? true;
      const denEmpty = connectorEmpty.get(ratioDef.denominator) ?? true;

      let ratio: number | null;
      if (numEmpty && denEmpty && KPI_HUB_DEMO_FACTS[code] != null) {
        ratio = KPI_HUB_DEMO_FACTS[code];
      } else {
        ratio = ratioPeriod(num ?? 0, den ?? 0, ratioDef.blank_if_zero);
        if (ratio != null && ratioDef.as_pct) {
          ratio = Math.round(ratio * 1000) / 10;
        }
        if (ratio == null && KPI_HUB_DEMO_FACTS[code] != null) {
          ratio = KPI_HUB_DEMO_FACTS[code];
        }
      }

      computed.set(code, ratio);
      await this.factsRepo.upsert({
        dictionary_id: dict.id,
        period_start: periodStart,
        period_end: periodEnd,
        actual_value: ratio,
        num_value: num,
        den_value: den,
        calculation_status: ratio == null ? 'NO_DATA' : 'SUCCESS',
        is_blank: ratio == null,
      });
    }

    await this.evaluateAlertsAfterCompute(period, computed);

    return {
      period,
      computed_at: new Date().toISOString(),
      status: 'SUCCESS' as const,
      facts_written: computed.size,
    };
  }

  async getFactValue(code: string, period: string): Promise<number | null> {
    const { periodStart } = periodDates(period);
    const facts = await this.factsRepo.getByCodes(periodStart, [code]);
    const row = facts.get(code);
    if (row?.actual_value != null) return row.actual_value;
    if (shouldUseMemoryFallback()) return KPI_HUB_DEMO_FACTS[code] ?? null;
    return KPI_HUB_DEMO_FACTS[code] ?? null;
  }

  async getFactsMap(period: string, codes: string[]): Promise<Map<string, number | null>> {
    const { periodStart } = periodDates(period);
    const facts = await this.factsRepo.getByCodes(periodStart, codes);
    const map = new Map<string, number | null>();
    for (const code of codes) {
      const row = facts.get(code);
      if (row?.actual_value != null) {
        map.set(code, row.actual_value);
      } else if (shouldUseMemoryFallback() || process.env.NODE_ENV === 'test') {
        map.set(code, KPI_HUB_DEMO_FACTS[code] ?? null);
      } else {
        map.set(code, KPI_HUB_DEMO_FACTS[code] ?? null);
      }
    }
    return map;
  }

  private async evaluateAlertsAfterCompute(period: string, computed: Map<string, number | null>) {
    for (const code of DASHBOARD_CODES) {
      const dict = await this.dictRepo.getByCode(code);
      if (!dict) continue;
      const actual = computed.get(code) ?? null;
      const targetRow = this.targets.resolveTarget(dict.id, period, {});
      if (!targetRow) continue;

      const previous_status = targetRow.status;
      const current_status = deriveHubStatus({
        direction: dict.direction,
        actual,
        target: targetRow.target_value,
        warning: targetRow.warning_value,
        critical: targetRow.critical_value,
      });

      this.alertEngine.afterFactCompute({
        dictionary_id: dict.id,
        dictionary_code: dict.code,
        period,
        scope_chain: {},
        scope_label: targetRow.scope_label,
        direction: dict.direction,
        actual,
        target: targetRow.target_value,
        warning: targetRow.warning_value,
        critical: targetRow.critical_value,
        previous_status,
      });
    }
  }
}

function shouldUseMemoryFallback(): boolean {
  return process.env.KPI_HUB_USE_MEMORY !== '0' && process.env.NODE_ENV === 'test';
}

export { DASHBOARD_CODES, FUNNEL_CODES };
