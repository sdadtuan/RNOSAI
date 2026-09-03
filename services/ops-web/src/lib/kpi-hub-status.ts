export type HubDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'RANGE' | 'NEUTRAL';
export type HubPerfStatus = 'ACHIEVED' | 'WARNING' | 'CRITICAL' | 'NO_DATA' | 'NO_STATUS';
export type FreshnessLevel = 'FRESH' | 'DELAYED' | 'FAILED' | 'UNKNOWN';

export function deriveHubStatus(input: {
  direction: HubDirection;
  actual: number | null;
  target: number | null;
  warning: number | null;
  critical: number | null;
}): HubPerfStatus {
  const { direction, actual, target, warning, critical } = input;
  if (actual == null || !Number.isFinite(actual)) return 'NO_DATA';
  if (target == null && warning == null && critical == null) return 'NO_STATUS';

  if (direction === 'LOWER_IS_BETTER') {
    if (critical != null && actual >= critical) return 'CRITICAL';
    if (warning != null && actual >= warning) return 'WARNING';
    if (target != null && actual <= target) return 'ACHIEVED';
    if (target != null && actual > target) {
      if (warning != null && actual < warning) return 'WARNING';
      if (critical != null && actual < critical) return 'WARNING';
      return 'CRITICAL';
    }
    return 'ACHIEVED';
  }

  if (direction === 'HIGHER_IS_BETTER') {
    if (critical != null && actual <= critical) return 'CRITICAL';
    if (warning != null && actual < warning && (critical == null || actual > critical)) {
      return 'WARNING';
    }
    if (target != null && actual >= target) return 'ACHIEVED';
    if (target != null && actual < target) {
      if (critical != null && actual <= critical) return 'CRITICAL';
      return 'WARNING';
    }
    return 'ACHIEVED';
  }

  if (direction === 'RANGE' && target != null) {
    const low = warning ?? target;
    const high = critical ?? target;
    if (actual < low || actual > high) return 'CRITICAL';
    if (actual !== target) return 'WARNING';
    return 'ACHIEVED';
  }

  return 'NO_STATUS';
}

export function achievementPct(
  direction: HubDirection,
  actual: number | null,
  target: number | null,
): number | null {
  if (actual == null || target == null || !Number.isFinite(actual) || !Number.isFinite(target)) {
    return null;
  }
  if (target === 0) return null;
  if (direction === 'LOWER_IS_BETTER') {
    return Math.round((target / actual) * 1000) / 10;
  }
  return Math.round((actual / target) * 1000) / 10;
}

export function ratioPeriod(num: number, den: number, blankIfZero: boolean): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den)) return null;
  if (den === 0) return blankIfZero ? null : null;
  return num / den;
}

export function freshnessStatus(
  lastSuccessAt: Date | null,
  slaMinutes: number,
  failed: boolean,
  now: Date,
): FreshnessLevel {
  if (failed) return 'FAILED';
  if (!lastSuccessAt) return 'UNKNOWN';
  const ageMs = now.getTime() - lastSuccessAt.getTime();
  const slaMs = slaMinutes * 60 * 1000;
  if (ageMs <= slaMs) return 'FRESH';
  return 'DELAYED';
}

export function hasFormulaCycle(edges: Array<{ from: string; to: string }>): boolean {
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const { from, to } of edges) {
    nodes.add(from);
    nodes.add(to);
    const list = adj.get(from) ?? [];
    list.push(to);
    adj.set(from, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node)) return true;
  }
  return false;
}
