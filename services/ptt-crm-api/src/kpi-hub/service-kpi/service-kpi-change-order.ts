export type ReconcileRowLike = {
  instance_id: string;
  dictionary_id: string;
  quoted: unknown;
  delivered: unknown;
  quality_status: string;
  behavior: string;
};

export const MATERIAL_VARIANCE_PCT = 15;

function extractTargetMax(quoted: unknown): number | null {
  if (quoted == null) return null;
  if (typeof quoted === 'number' && Number.isFinite(quoted)) return quoted;
  if (typeof quoted === 'object' && !Array.isArray(quoted)) {
    const row = quoted as Record<string, unknown>;
    const max = row.target_max ?? row.max;
    if (typeof max === 'number' && Number.isFinite(max)) return max;
    const min = row.target_min ?? row.min;
    if (typeof min === 'number' && Number.isFinite(min)) return min;
  }
  return null;
}

function extractNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if (typeof row.value === 'number') return row.value;
    if (typeof row.actual === 'number') return row.actual;
  }
  return null;
}

export function variancePctAgainstQuoted(quoted: unknown, delivered: unknown): number | null {
  const baseline = extractTargetMax(quoted);
  const actual = extractNumeric(delivered);
  if (baseline == null || actual == null || baseline === 0) return null;
  return Math.round(((actual - baseline) / baseline) * 100);
}

export function isMaterialReconcileVariance(row: ReconcileRowLike): boolean {
  if (row.behavior === 'Chặn Reported') return true;
  if (row.quality_status === 'pending_validation' || row.quality_status === 'invalid') return true;
  const pct = variancePctAgainstQuoted(row.quoted, row.delivered);
  if (pct == null) return false;
  return Math.abs(pct) >= MATERIAL_VARIANCE_PCT;
}

export function flagMaterialReconcileRows<T extends ReconcileRowLike>(
  rows: T[],
): Array<T & { material_variance: boolean; variance_pct: number | null }> {
  return rows.map((row) => ({
    ...row,
    material_variance: isMaterialReconcileVariance(row),
    variance_pct: variancePctAgainstQuoted(row.quoted, row.delivered),
  }));
}
