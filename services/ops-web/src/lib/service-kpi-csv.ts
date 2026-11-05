import type { ImportActualRow } from './service-kpi-types';

/** Parse CSV with header: instance_id|dictionary_id,source_id,period_start,period_end,value,... */
export function parseActualImportCsv(text: string): ImportActualRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const rows: ImportActualRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const get = (name: string) => {
      const j = idx(name);
      return j >= 0 ? cols[j]?.trim() : '';
    };
    const periodStart = get('period_start');
    const periodEnd = get('period_end');
    if (!periodStart || !periodEnd) continue;
    const valueRaw = get('value');
    rows.push({
      instance_id: get('instance_id') || undefined,
      dictionary_id: get('dictionary_id') || undefined,
      source_id: get('source_id') || undefined,
      period_start: periodStart,
      period_end: periodEnd,
      value: valueRaw ? Number(valueRaw) : null,
      quality_status: get('quality_status') || 'pending_validation',
      source_ref: get('source_ref') || 'import',
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export const ACTUAL_IMPORT_CSV_TEMPLATE = `instance_id,period_start,period_end,value,quality_status,source_ref
,dictionary_id,source_id,period_start,period_end,value,quality_status,source_ref`;
