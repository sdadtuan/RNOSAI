export function assertKpisAttachable(
  rows: Array<{ dictionary_id: string; status: string }>,
  existingIds: string[] = [],
): { ok: boolean; errors: string[]; code?: 'KPI_DEPRECATED' | 'KPI_DUPLICATE' } {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status === 'DEPRECATED') {
      errors.push(`KPI ${row.dictionary_id} is deprecated`);
    }
    if (existingIds.includes(row.dictionary_id)) {
      errors.push(`KPI ${row.dictionary_id} already attached`);
    }
    if (seen.has(row.dictionary_id)) {
      errors.push(`Duplicate KPI ${row.dictionary_id} in request`);
    }
    seen.add(row.dictionary_id);
  }

  if (errors.some((e) => e.includes('deprecated'))) {
    return { ok: false, errors, code: 'KPI_DEPRECATED' };
  }
  if (errors.some((e) => e.includes('Duplicate') || e.includes('already attached'))) {
    return { ok: false, errors, code: 'KPI_DUPLICATE' };
  }
  return { ok: true, errors: [] };
}
