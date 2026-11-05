export interface AeTeamSortRow {
  staff_id: number;
  name: string;
  accepting: boolean;
  open_leads: number;
  sla_breach: number;
  sla_warning: number;
  within_sla_pct: number | null;
  avg_first_response_minutes: number | null;
  calls: number;
  answer_pct: number | null;
  stale: number;
  missed_callbacks: number;
  lead_to_quote_pct: number | null;
  quote_to_won_pct: number | null;
  revenue_vnd: number | null;
  attainment_pct: number | null;
  tone: 'green' | 'yellow' | 'red';
  by_status: { moi: number; da_lien_he: number; dang_tu_van: number; bao_gia: number };
}

export type AeTeamSortKey = keyof Pick<
  AeTeamSortRow,
  | 'name'
  | 'open_leads'
  | 'sla_breach'
  | 'sla_warning'
  | 'within_sla_pct'
  | 'avg_first_response_minutes'
  | 'calls'
  | 'answer_pct'
  | 'stale'
  | 'missed_callbacks'
  | 'lead_to_quote_pct'
  | 'quote_to_won_pct'
  | 'revenue_vnd'
  | 'attainment_pct'
>;

function valueOf(row: AeTeamSortRow, key: AeTeamSortKey): string | number {
  const value = row[key];
  if (value == null) return key === 'name' ? '' : -1;
  return value;
}

export function sortAeTeamRows<T extends AeTeamSortRow>(
  rows: T[],
  key: AeTeamSortKey = 'sla_breach',
  direction: 'asc' | 'desc' = 'desc',
): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a, key);
    const right = valueOf(b, key);
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right), 'vi') * factor;
    }
    return (left - right) * factor || a.staff_id - b.staff_id;
  });
}
