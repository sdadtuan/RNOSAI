import type { TowerColumnId, TowerColumnOpts, TowerEntityInput } from './ceo-tower.types';

export function isTowerUatSeed(leadId: number | null | undefined, tags: string[] = []): boolean {
  const id = Number(leadId ?? 0);
  if (id >= 900000901) return true;
  return tags.some((t) => /mkt-ai-(smoke-seed|seed-)/i.test(String(t)));
}

export function assignTowerColumn(
  e: TowerEntityInput,
  opts: TowerColumnOpts = {},
): TowerColumnId {
  if (e.factory === 'B') {
    if (opts.factoryFilter === 'B' && e.spaOnBoard && !e.firstCallDone) return 'lead_b2';
    return 'care';
  }
  if (e.hasLifecycle || (e.won && e.hasLifecycle)) {
    if (e.clientActive || e.retain) return 'care';
    if (e.hasLifecycle) return 'tmmt_deliver';
  }
  if (e.won && !e.hasLifecycle) return 'contract';
  if (e.contractPendingOrActive) return 'contract';
  if (e.intakeGo) return 'consult';
  if (e.b2Done) return 'intake';
  return 'lead_b2';
}
