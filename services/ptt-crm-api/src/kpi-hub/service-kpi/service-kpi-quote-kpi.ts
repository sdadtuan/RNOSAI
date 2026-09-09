import { clientWording, isInternalOnly, type SkpiClassification } from './service-kpi-classification';
import type { ServiceKpiInstanceRow } from './service-kpi.types';

const CLASS_SLUG: Record<SkpiClassification, string> = {
  COMMITTED_DELIVERABLE: 'committed',
  QUALITY_STANDARD: 'quality_standard',
  OPTIMIZATION_TARGET: 'optimization_target',
  PROJECTED_RESULT: 'projected_result',
  BUSINESS_OUTCOME: 'business_outcome',
  INTERNAL_OPERATIONAL: 'internal_operational',
};

export function classificationToQuoteClass(classification: SkpiClassification): string {
  return CLASS_SLUG[classification] ?? 'projected_result';
}

export function formatTargetRange(inst: Pick<ServiceKpiInstanceRow, 'target_min' | 'target_max'>): string | null {
  if (inst.target_min != null && inst.target_max != null) {
    return `${inst.target_min}–${inst.target_max}`;
  }
  if (inst.target_max != null) return String(inst.target_max);
  if (inst.target_min != null) return String(inst.target_min);
  return null;
}

export function instanceToQuoteKpi(
  inst: ServiceKpiInstanceRow,
  ctx?: { dv_code?: string },
): Record<string, unknown> {
  return {
    id: inst.id,
    name: inst.dictionary_id,
    class: classificationToQuoteClass(inst.classification),
    label_vi: clientWording(inst.classification),
    value_text: formatTargetRange(inst),
    source: `service_kpi:${inst.dv_code ?? ctx?.dv_code ?? ''}`,
    assumption: inst.assumption_text?.trim() || null,
    disclaimer: inst.disclaimer_text?.trim() || null,
    service_kpi: true,
  };
}

export function mergeQuoteKpis(
  legacy: Record<string, unknown>[],
  fromInstances: ServiceKpiInstanceRow[],
  benchmarkHints?: Map<string, string>,
): Record<string, unknown>[] {
  const serviceRows = fromInstances
    .filter((inst) => !isInternalOnly(inst.classification))
    .map((inst) => {
      const row = instanceToQuoteKpi(inst);
      const hint = benchmarkHints?.get(inst.dictionary_id);
      if (hint) row.benchmark_hint = hint;
      return row;
    });
  const seen = new Set(serviceRows.map((r) => String(r.name)));
  const dedupedLegacy = legacy.filter((row) => !seen.has(String(row.name ?? '')));
  return [...dedupedLegacy, ...serviceRows];
}
