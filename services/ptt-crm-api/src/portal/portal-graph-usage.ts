import { Logger } from '@nestjs/common';

const log = new Logger('PortalGraphUsage');

export const GRAPH_HARD_PAUSE_CODES = [4, 17, 32, 613, 80001, 80004] as const;
const HARD_PAUSE = new Set<number>(GRAPH_HARD_PAUSE_CODES);

export type GraphUsageSnapshot = {
  call_count: number;
  total_cputime: number;
  total_time: number;
  source: string;
};

type UsageState = {
  pauseUntil: number;
  backoffMs: number;
  lastUsage: GraphUsageSnapshot | null;
  counts: Map<string, number>;
  hourStartedAt: number;
};

const state: UsageState = {
  pauseUntil: 0,
  backoffMs: 60_000,
  lastUsage: null,
  counts: new Map(),
  hourStartedAt: Date.now(),
};

export function resetGraphUsageForTests(): void {
  state.pauseUntil = 0;
  state.backoffMs = 60_000;
  state.lastUsage = null;
  state.counts.clear();
  state.hourStartedAt = Date.now();
}

export function classifyGraphPath(pathOrUrl: string): string {
  const raw = pathOrUrl.toLowerCase();
  if (raw.includes('/me/accounts')) return 'me_accounts';
  if (raw.includes('/me/adaccounts')) return 'me_adaccounts';
  if (raw.includes('leadgen_forms') || raw.includes('/leads?') || raw.includes('/leads&') || /\/leads$/.test(raw)) {
    return 'leads';
  }
  if (raw.includes('/conversations')) return 'conversations';
  if (raw.includes('/messages')) return 'messages';
  if (raw.includes('/insights')) return 'insights';
  return 'other';
}

export function parseGraphUsageHeader(raw: string | null | undefined): GraphUsageSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const pick = (item: Record<string, unknown>, source: string): GraphUsageSnapshot => ({
      call_count: Number(item.call_count ?? 0) || 0,
      total_cputime: Number(item.total_cputime ?? 0) || 0,
      total_time: Number(item.total_time ?? 0) || 0,
      source,
    });
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if ('call_count' in obj || 'total_cputime' in obj || 'total_time' in obj) {
      return pick(obj, 'x-app-usage');
    }
    let best: GraphUsageSnapshot | null = null;
    for (const [key, value] of Object.entries(obj)) {
      const row = Array.isArray(value) ? value[0] : value;
      if (!row || typeof row !== 'object') continue;
      const snap = pick(row as Record<string, unknown>, `x-business-use-case-usage:${key}`);
      const score = Math.max(snap.call_count, snap.total_cputime, snap.total_time);
      const bestScore = best ? Math.max(best.call_count, best.total_cputime, best.total_time) : -1;
      if (score > bestScore) best = snap;
    }
    return best;
  } catch {
    return null;
  }
}

export function usagePercent(snapshot: GraphUsageSnapshot | null): number {
  if (!snapshot) return 0;
  return Math.max(snapshot.call_count, snapshot.total_cputime, snapshot.total_time);
}

export function isGraphHardPauseCode(code: number): boolean {
  return HARD_PAUSE.has(code);
}

export function extractGraphErrorCode(body: unknown): number {
  if (!body || typeof body !== 'object') return 0;
  const error = (body as { error?: { code?: unknown; error_subcode?: unknown } }).error;
  if (!error) return 0;
  return Number(error.code ?? error.error_subcode ?? 0) || 0;
}

function jitter(ms: number): number {
  const spread = Math.floor(ms * 0.2);
  return ms + Math.floor(Math.random() * (spread + 1));
}

function setPause(ms: number, reason: string): void {
  const wait = jitter(Math.max(1_000, ms));
  state.pauseUntil = Math.max(state.pauseUntil, Date.now() + wait);
  log.warn(`portal-graph pause ${wait}ms reason=${reason}`);
}

export function noteGraphUsageSnapshot(snapshot: GraphUsageSnapshot | null): void {
  if (!snapshot) return;
  state.lastUsage = snapshot;
  const pct = usagePercent(snapshot);
  if (pct >= 90) {
    state.backoffMs = Math.min(Math.max(state.backoffMs, 5 * 60_000) * 2, 30 * 60_000);
    setPause(state.backoffMs, `usage_${pct}`);
  } else if (pct >= 75) {
    setPause(Math.max(5 * 60_000, state.backoffMs), `usage_${pct}`);
  }
}

export function noteGraphHeaders(headers: Headers): GraphUsageSnapshot | null {
  const candidates = [
    parseGraphUsageHeader(headers.get('x-page-usage')),
    parseGraphUsageHeader(headers.get('x-app-usage')),
    parseGraphUsageHeader(headers.get('x-business-use-case-usage')),
  ].filter((item): item is GraphUsageSnapshot => Boolean(item));
  if (!candidates.length) return null;
  const snapshot = [...candidates].sort((a, b) => usagePercent(b) - usagePercent(a))[0];
  noteGraphUsageSnapshot(snapshot);
  return snapshot;
}

export function noteGraphError(message: string, code = 0): void {
  const inferred =
    code ||
    (/#4\b/.test(message) ? 4 : /#17\b/.test(message) ? 17 : /#32\b/.test(message) ? 32 : /#613\b/.test(message) ? 613 : 0);
  if (!isGraphHardPauseCode(inferred) && !/request limit|too many calls|rate limit/i.test(message)) return;
  state.backoffMs = Math.min(state.backoffMs * 2, 30 * 60_000);
  setPause(state.backoffMs, `code_${inferred || 'limit'}`);
}

export function shouldPauseGraph(now = Date.now()): boolean {
  return now < state.pauseUntil;
}

export function graphPauseRemainingMs(now = Date.now()): number {
  return Math.max(0, state.pauseUntil - now);
}

export function recordGraphCall(kind: string): void {
  maybeFlushHourly();
  state.counts.set(kind, (state.counts.get(kind) ?? 0) + 1);
}

function maybeFlushHourly(): void {
  if (Date.now() - state.hourStartedAt < 3_600_000) return;
  const parts = [...state.counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}=${value}`);
  const total = [...state.counts.values()].reduce((sum, value) => sum + value, 0);
  const usage = state.lastUsage;
  log.log(
    `portal-graph-usage hour_calls=${total}${parts.length ? ` ${parts.join(' ')}` : ''}` +
      (usage ? ` app_usage=${usagePercent(usage)}% source=${usage.source}` : ''),
  );
  state.counts.clear();
  state.hourStartedAt = Date.now();
  state.backoffMs = 60_000;
}

export function graphUsageStatus(): {
  paused: boolean;
  pause_remaining_ms: number;
  last_usage: GraphUsageSnapshot | null;
  last_usage_percent: number;
  calls_this_hour: Record<string, number>;
} {
  maybeFlushHourly();
  return {
    paused: shouldPauseGraph(),
    pause_remaining_ms: graphPauseRemainingMs(),
    last_usage: state.lastUsage,
    last_usage_percent: usagePercent(state.lastUsage),
    calls_this_hour: Object.fromEntries(state.counts),
  };
}
