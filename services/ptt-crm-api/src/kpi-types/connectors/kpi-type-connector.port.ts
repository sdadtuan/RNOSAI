import type { KpiTypeDivideByZero, KpiTypeSourceHealth } from '../kpi-types.types';
import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';

export type KpiTypePreviewPeriod = {
  from: Date;
  to: Date;
};

export type KpiTypePreviewResult = {
  value: number | null;
  records_scanned: number | null;
  formatted_hint?: string;
  health: KpiTypeSourceHealth;
  error?: string;
};

export interface KpiTypeDataSourceAdapter {
  readonly adapterKey: string;
  preview(ast: KpiFormulaAst, period: KpiTypePreviewPeriod): Promise<KpiTypePreviewResult>;
  checkHealth(): Promise<KpiTypeSourceHealth>;
}

export function applyDivideByZero(
  numerator: number,
  denominator: number,
  fallback: KpiTypeDivideByZero,
): { value: number | null; error?: string } {
  if (denominator !== 0) return { value: numerator / denominator };
  if (fallback === 'ZERO') return { value: 0 };
  if (fallback === 'NA') return { value: null };
  return { value: null, error: 'DIVIDE_BY_ZERO' };
}

export function defaultEvaluationPeriod(now = new Date()): KpiTypePreviewPeriod {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCMonth(from.getUTCMonth() - 3);
  return { from, to };
}

export function parseTestPeriod(raw?: { from?: string; to?: string }): KpiTypePreviewPeriod {
  if (!raw?.from || !raw?.to) return defaultEvaluationPeriod();
  const from = new Date(raw.from);
  const to = new Date(raw.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return defaultEvaluationPeriod();
  }
  return { from, to };
}
