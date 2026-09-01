import type { TowerColumnId, TowerFactory, TowerSeverity } from './ceo-tower.types';

export type ClockInput = {
  columnId: TowerColumnId;
  factory: TowerFactory;
  elapsedMs: number;
  noOwner?: boolean;
  noB2?: boolean;
  wonNoLifecycle?: boolean;
  firstCallBreach?: boolean;
};

const H = 3600_000;
const D = 24 * H;

export function clockSeverity(input: ClockInput): TowerSeverity {
  const t = input.elapsedMs;
  if (input.columnId === 'lead_b2' && input.factory === 'A') {
    if (input.noOwner) {
      if (t >= 4 * H) return 'red';
      if (t >= 2 * H) return 'amber';
    }
    if (input.noB2) {
      if (t >= 8 * H) return 'red';
      if (t >= 4 * H) return 'amber';
    }
    return 'ok';
  }
  if (input.columnId === 'lead_b2' && input.factory === 'B') {
    return input.firstCallBreach ? 'red' : 'ok';
  }
  if (input.columnId === 'intake') {
    if (t >= 5 * D) return 'red';
    if (t >= 3 * D) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'consult') {
    if (t >= 10 * D) return 'red';
    if (t >= 5 * D) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'contract') {
    if (input.wonNoLifecycle && t >= 24 * H) return 'red';
    if (t >= 48 * H) return 'red';
    if (t >= 24 * H) return 'amber';
    return 'ok';
  }
  if (input.columnId === 'tmmt_deliver') {
    if (t >= 7 * D) return 'red';
    if (t >= 5 * D) return 'amber';
    return 'ok';
  }
  return 'ok';
}

export function worseSeverity(a: TowerSeverity, b: TowerSeverity): TowerSeverity {
  const rank = { red: 2, amber: 1, ok: 0 };
  return rank[a] >= rank[b] ? a : b;
}
