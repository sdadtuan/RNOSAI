import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export function dictionaryLabelMap(rows: KpiHubDictionaryRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) out[row.id] = `${row.code} · ${row.name}`;
  return out;
}
