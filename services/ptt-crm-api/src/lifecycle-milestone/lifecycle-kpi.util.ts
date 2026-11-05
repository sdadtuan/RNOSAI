const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function calendarMinutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return -1;
  return Math.round((end - start) / MS_PER_MINUTE);
}

export function calendarDaysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return -1;
  return Math.round((end - start) / MS_PER_DAY);
}

export function computeK1(rows: { created_at: string; b2_at: string }[]): {
  median_minutes: number | null;
  n: number;
} {
  const minutes = rows
    .map((r) => calendarMinutesBetween(r.created_at, r.b2_at))
    .filter((v) => v >= 0);
  return { median_minutes: median(minutes), n: minutes.length };
}

export function computeK2(rows: { b2_at: string; intake_at: string }[]): {
  median_days: number | null;
  n: number;
} {
  const days = rows
    .map((r) => calendarDaysBetween(r.b2_at, r.intake_at))
    .filter((v) => v >= 0);
  return { median_days: median(days), n: days.length };
}

export function computeK3(rows: { contract_at: string; client_at: string }[]): {
  median_days: number | null;
  n: number;
} {
  const days = rows
    .map((r) => calendarDaysBetween(r.contract_at, r.client_at))
    .filter((v) => v >= 0);
  return { median_days: median(days), n: days.length };
}

export function computeK4Compliance(counts: { ok: number; breach: number }): {
  pct: number | null;
  n: number;
} {
  const evaluated = counts.ok + counts.breach;
  if (evaluated <= 0) return { pct: null, n: 0 };
  return { pct: Math.round((counts.ok / evaluated) * 1000) / 10, n: evaluated };
}
