export type KpiDirection = 'higher' | 'lower' | 'maintain' | 'within_range' | 'exact';

export type HealthStatus = 'green' | 'yellow' | 'red' | 'no_data';

export function progressPercent(input: {
  actual: number | null;
  target: number | null;
  direction: KpiDirection;
  rangeMin?: number | null;
  rangeMax?: number | null;
}): number | null {
  const { actual, target, direction } = input;
  if (actual == null || !Number.isFinite(actual)) return null;
  if (direction === 'within_range') {
    const min = input.rangeMin ?? target;
    const max = input.rangeMax ?? target;
    if (min == null || max == null) return null;
    if (actual >= min && actual <= max) return 100;
    const mid = (min + max) / 2;
    const span = Math.max(max - min, 1);
    return Math.max(0, Math.round((1 - Math.abs(actual - mid) / span) * 1000) / 10);
  }
  if (target == null || !Number.isFinite(target) || target === 0) return null;
  if (direction === 'lower') {
    if (actual === 0) return 0;
    return Math.round((target / actual) * 1000) / 10;
  }
  if (direction === 'exact') return actual === target ? 100 : 0;
  return Math.round((actual / target) * 1000) / 10;
}

export function healthFromProgress(
  progress: number | null,
  greenMin = 90,
  yellowMin = 70,
): HealthStatus {
  if (progress == null) return 'no_data';
  if (progress >= greenMin) return 'green';
  if (progress >= yellowMin) return 'yellow';
  return 'red';
}

/** Lower-is-better: Green when actual ≤ target; Red when overrun >10%. */
export function healthFromDirection(input: {
  actual: number | null;
  target: number | null;
  direction: KpiDirection;
  progress: number | null;
}): HealthStatus {
  const { actual, target, direction, progress } = input;
  if (direction === 'lower') {
    if (actual == null || target == null) return 'no_data';
    if (actual <= target) return 'green';
    if (actual <= target * 1.1) return 'yellow';
    return 'red';
  }
  return healthFromProgress(progress);
}

export function scorecardWeightedScore(
  items: Array<{ score: number | null; weight: number }>,
): number | null {
  const ready = items.filter((i) => i.score != null && Number.isFinite(i.weight));
  if (!ready.length) return null;
  const total = ready.reduce((sum, i) => sum + (i.score as number) * i.weight, 0);
  return Math.round(total) / 100;
}

export function validateScorecardWeights(weights: number[], requireExact = true): {
  total: number;
  valid: boolean;
} {
  const total = Math.round(weights.reduce((s, w) => s + w, 0) * 10) / 10;
  return { total, valid: requireExact ? total === 100 : total <= 100 };
}
