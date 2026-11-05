export const DEFAULT_MIN_GROSS_MARGIN_PCT = 30;

export type BudgetItemKind = 'labor' | 'production' | 'software' | 'media' | 'other';
export type MediaBorne = 'agency_borne' | 'client_borne';

function toCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  const sign = whole < 0 || trimmed.startsWith('-') ? -1 : 1;
  return sign * (Math.abs(whole) * 100 + frac);
}

export function parseDecimal(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const str = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!str) return null;
  const cents = toCents(str);
  if (cents == null || !Number.isFinite(cents)) return null;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

function addDecimal(a: string, b: string): string {
  const ca = toCents(a) ?? 0;
  const cb = toCents(b) ?? 0;
  return centsToDecimal(ca + cb);
}

function subDecimal(a: string, b: string): string {
  const ca = toCents(a) ?? 0;
  const cb = toCents(b) ?? 0;
  return centsToDecimal(ca - cb);
}

function divDecimalPct(numerator: string, denominator: string): string | null {
  const num = toCents(numerator);
  const den = toCents(denominator);
  if (num == null || den == null || den === 0) return null;
  const pct = Math.round((num * 10000) / den) / 100;
  return pct.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function computeGrossMarginPct(input: {
  contract: string;
  internalForecast: string;
  contingency: string;
}): string | null {
  const contract = parseDecimal(input.contract);
  if (contract == null || contract === '0.00' || contract === '0') return null;
  const internal = parseDecimal(input.internalForecast) ?? '0.00';
  const contingency = parseDecimal(input.contingency) ?? '0.00';
  const profit = subDecimal(subDecimal(contract, internal), contingency);
  return divDecimalPct(profit, contract);
}

export function internalCostFromItems(
  items: Array<{ amount: string; media_borne?: MediaBorne; kind: string }>,
): string {
  let totalCents = 0;
  for (const item of items) {
    if (item.kind === 'media' && item.media_borne === 'client_borne') continue;
    const cents = toCents(parseDecimal(item.amount) ?? '0') ?? 0;
    totalCents += cents;
  }
  return centsToDecimal(totalCents);
}

export function allocateEven(forecast: string, periods: string[]): Array<{ period: string; amount: string }> {
  if (periods.length === 0) return [];
  const totalCents = toCents(parseDecimal(forecast) ?? '0') ?? 0;
  const n = periods.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return periods.map((period, i) => {
    const cents = i === n - 1 ? base + remainder : base;
    return { period, amount: centsToDecimal(cents) };
  });
}

export function allocateByMilestone(
  forecast: string,
  weights: Array<{ milestone_id: string; weight: number }>,
): Array<{ milestone_id: string; amount: string }> {
  if (weights.length === 0) return [];
  const totalCents = toCents(parseDecimal(forecast) ?? '0') ?? 0;
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) {
    return weights.map((w) => ({ milestone_id: w.milestone_id, amount: '0.00' }));
  }
  let allocated = 0;
  return weights.map((w, i) => {
    if (i === weights.length - 1) {
      return { milestone_id: w.milestone_id, amount: centsToDecimal(totalCents - allocated) };
    }
    const cents = Math.floor((totalCents * w.weight) / totalWeight);
    allocated += cents;
    return { milestone_id: w.milestone_id, amount: centsToDecimal(cents) };
  });
}

export function validateManualAlloc(
  forecast: string,
  rows: Array<{ amount: string }>,
): { ok: boolean; code?: 'ALLOC_SUM_MISMATCH' } {
  const fc = toCents(parseDecimal(forecast) ?? '0') ?? 0;
  const sum = rows.reduce((s, r) => s + (toCents(parseDecimal(r.amount) ?? '0') ?? 0), 0);
  if (sum !== fc) return { ok: false, code: 'ALLOC_SUM_MISMATCH' };
  return { ok: true };
}

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function overlapAllocationPct(
  assignments: Array<{
    staff_id: number;
    pct: number;
    start: string;
    end: string;
    project_status: string;
  }>,
  staffId: number,
  range: { start: string; end: string },
): number {
  let total = 0;
  for (const a of assignments) {
    if (a.staff_id !== staffId) continue;
    if (a.project_status !== 'active' && a.project_status !== 'draft') continue;
    if (datesOverlap(a.start, a.end, range.start, range.end)) {
      total += a.pct;
    }
  }
  return total;
}

export function financeApprovalRequired(input: {
  marginPct: string | null;
  minMargin: number;
  forecast: string;
  budget: string;
}): { marginCritical: boolean; forecastWarn: boolean; requireFinance: boolean } {
  const marginNum = input.marginPct != null ? Number(input.marginPct) : null;
  const marginCritical = marginNum != null && marginNum < input.minMargin;
  const fc = toCents(parseDecimal(input.forecast) ?? '0') ?? 0;
  const bg = toCents(parseDecimal(input.budget) ?? '0') ?? 0;
  const forecastWarn = fc > bg;
  const requireFinance = marginCritical || forecastWarn;
  return { marginCritical, forecastWarn, requireFinance };
}
