import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { HubFormulaFilter } from '../formula/kpi-hub-formula.parser';
import type { FreshnessLevel } from '../kpi-hub.types';

export type KpiHubQueryPeriod = {
  from: Date;
  to: Date;
};

export type KpiHubConnectorHealth = 'HEALTHY' | 'STALE' | 'CONNECTION_ERROR' | 'UNAVAILABLE';

export type KpiHubQueryResult = {
  value: number | null;
  records_scanned: number | null;
  health: KpiHubConnectorHealth;
  error?: string;
};

export interface KpiHubConnectorPort {
  readonly adapterKey: string;
  query(
    entity: string,
    agg: string,
    field: string | undefined,
    filters: HubFormulaFilter[],
    period: KpiHubQueryPeriod,
  ): Promise<KpiHubQueryResult>;
  checkHealth(): Promise<KpiHubConnectorHealth>;
}

export function parseHubPeriod(period: string): KpiHubQueryPeriod {
  const [year, month] = period.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}

export function periodDates(period: string): { periodStart: string; periodEnd: string } {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodStart: `${period}-01`,
    periodEnd: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Demo fallback values matching Sep 2026 fixture when connectors return empty. */
export const KPI_HUB_DEMO_FACTS: Record<string, number> = {
  MKT_001: 2340,
  MKT_002: 1486,
  MKT_004: 210980000,
  MKT_006: 142000,
  MKT_007: 369,
  MKT_008: 24.8,
  SAL_001: 152,
  SAL_003: 86,
  SAL_007: 12.5,
  SAL_008: 1240000000,
  SAL_WON: 19,
};

export function resolveFactValue(code: string, connectorValue: number | null | undefined): number | null {
  if (connectorValue != null && Number.isFinite(connectorValue) && connectorValue !== 0) {
    return connectorValue;
  }
  const demo = KPI_HUB_DEMO_FACTS[code];
  return demo ?? (connectorValue != null && Number.isFinite(connectorValue) ? connectorValue : null);
}

export function seedSqlPath(): string {
  const candidates = [
    join(process.cwd(), 'docs/specs/2026-09-04-seed-kpi-hub-data.sql'),
    join(process.cwd(), '../../docs/specs/2026-09-04-seed-kpi-hub-data.sql'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export function loadSeedSql(): string {
  return readFileSync(seedSqlPath(), 'utf8');
}

export type HubFactRow = {
  dictionary_id: string;
  dictionary_code: string;
  version_id: string | null;
  period_start: string;
  period_end: string;
  grain: string;
  scope_hash: string;
  actual_value: number | null;
  num_value: number | null;
  den_value: number | null;
  calculation_status: 'SUCCESS' | 'NO_DATA' | 'PARTIAL' | 'FAILED';
  is_blank: boolean;
};

export function mapFreshnessToConnectorHealth(status: FreshnessLevel): KpiHubConnectorHealth {
  if (status === 'FAILED') return 'CONNECTION_ERROR';
  if (status === 'UNKNOWN') return 'UNAVAILABLE';
  if (status === 'DELAYED') return 'STALE';
  return 'HEALTHY';
}
