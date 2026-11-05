export type CsdSlaRateFilter = {
  created_from: string;
  created_to: string;
  scope_status?: 'in_scope';
};

export type CsdSlaRateRow = {
  scope_status?: string | null;
  status?: string | null;
  sla_status?: string | null;
  created_at?: string | Date | null;
  first_response_at?: string | Date | null;
  first_response_due_at?: string | Date | null;
  sla_response_due_at?: string | Date | null;
  resolved_at?: string | Date | null;
  closed_at?: string | Date | null;
  resolve_due_at?: string | Date | null;
  sla_resolution_due_at?: string | Date | null;
};

const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'client_acceptance']);

function millis(value: string | Date | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(n) ? n : null;
}

function ymd(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function responseDue(row: CsdSlaRateRow): number | null {
  return millis(row.first_response_due_at ?? row.sla_response_due_at);
}

function resolveDue(row: CsdSlaRateRow): number | null {
  return millis(row.resolve_due_at ?? row.sla_resolution_due_at);
}

function hasDue(row: CsdSlaRateRow): boolean {
  return responseDue(row) != null || resolveDue(row) != null;
}

function inCreatedPeriod(row: CsdSlaRateRow, filter?: CsdSlaRateFilter): boolean {
  if (!filter) return true;
  const created = ymd(row.created_at);
  if (!created) return false;
  return created >= filter.created_from && created <= filter.created_to;
}

function responseOnTime(row: CsdSlaRateRow): boolean {
  const due = responseDue(row);
  if (due == null) return true;
  const first = millis(row.first_response_at);
  if (first == null) return true;
  return first <= due;
}

function resolveOnTime(row: CsdSlaRateRow): boolean {
  const status = String(row.status ?? '');
  if (RESOLVED_STATUSES.has(status)) {
    const due = resolveDue(row);
    if (due == null) return true;
    const done = millis(row.resolved_at) ?? millis(row.closed_at);
    if (done == null) return false;
    return done <= due;
  }
  return String(row.sla_status ?? '') !== 'breached';
}

export function csdSlaRate(rows: CsdSlaRateRow[], filter?: CsdSlaRateFilter): number | null {
  const scope = filter?.scope_status ?? 'in_scope';
  const sample = (rows ?? []).filter((row) => {
    if (String(row.scope_status ?? '') !== scope) return false;
    if (!hasDue(row)) return false;
    return inCreatedPeriod(row, filter);
  });
  if (sample.length === 0) return null;
  const onTime = sample.filter((row) => responseOnTime(row) && resolveOnTime(row)).length;
  return (onTime / sample.length) * 100;
}
