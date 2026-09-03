export function kpiAchievementPct(
  higherIsBetter: number,
  targetValue: unknown,
  actualValue: unknown,
): number | null {
  if (targetValue == null || actualValue == null) return null;
  const t = Number(targetValue);
  const a = Number(actualValue);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t === 0) return null;
  const hi = Number(higherIsBetter || 1) === 1;
  if (hi) return Math.round(100 * Math.min(1, a / t) * 100) / 100;
  return Math.round(100 * Math.min(1, t / Math.max(a, 1e-9)) * 100) / 100;
}

export type KpiRag = 'green' | 'yellow' | 'red' | 'no_data';

export function deriveKpiRag(
  higherIsBetter: number,
  target: unknown,
  actual: unknown,
): KpiRag {
  const hiArg = Number(higherIsBetter ?? 1) === 1 ? 1 : 2;
  const pct = kpiAchievementPct(hiArg, target, actual);
  if (pct == null) return 'no_data';
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  return 'red';
}

export function kpiUpdateDeadlineIso(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-05T16:59:59.999Z`;
}

export function kpiIsOnTime(
  actual: unknown,
  updatedAt: string | null | undefined,
  year: number,
  month: number,
  now: Date,
): boolean {
  if (actual == null || actual === '') return false;
  const deadline = new Date(kpiUpdateDeadlineIso(year, month));
  if (now.getTime() < deadline.getTime()) return true;
  if (!updatedAt) return false;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  return updated.getTime() <= deadline.getTime();
}
