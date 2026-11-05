import { randomUUID } from 'crypto';
import { kpiHubMemory } from '../kpi-hub.memory-store';
import type { ServiceKpiInstanceRow } from './service-kpi.types';

export function isCriticalCplVariance(row: Pick<ServiceKpiInstanceRow, 'classification' | 'variance_pct'>): boolean {
  return row.classification === 'OPTIMIZATION_TARGET' && (row.variance_pct ?? 0) > 25;
}

export function fireServiceKpiVarianceAlert(
  row: Pick<ServiceKpiInstanceRow, 'id' | 'dictionary_id' | 'dv_code' | 'variance_pct' | 'latest_actual' | 'target_max'>,
): void {
  if (!isCriticalCplVariance(row as ServiceKpiInstanceRow)) return;
  kpiHubMemory.alerts.unshift({
    id: randomUUID(),
    rule_id: `skpi-var-${row.id}`,
    dictionary_id: row.dictionary_id,
    dictionary_code: row.dictionary_id,
    level: 'CRITICAL',
    title: `${row.dictionary_id} vượt CPL max >25% (${row.dv_code ?? ''})`,
    scope: row.dv_code ?? 'service_kpi',
    actual: row.latest_actual ?? null,
    threshold: row.target_max ?? null,
    status: 'OPEN',
    age: '0m',
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    acknowledged_by: null,
  });
}
