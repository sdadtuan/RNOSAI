export type CpLedgerRow = {
  kind: 'grant' | 'reserve' | 'charge' | 'release' | 'refund' | 'adjustment' | 'expiry';
  amount: number;
};

export function ledgerBalance(
  rows: CpLedgerRow[],
): { used: number | null; remaining: number | null } {
  if (!rows.length) return { used: null, remaining: null };

  let allocated = 0;
  let used = 0;
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (row.kind === 'grant' || row.kind === 'adjustment') allocated += amount;
    if (row.kind === 'expiry') allocated -= amount;
    if (row.kind === 'reserve' || row.kind === 'charge') used += amount;
    if (row.kind === 'release' || row.kind === 'refund') used -= amount;
  }
  return { used, remaining: allocated - used };
}

export function canChargeIdempotent(existingKey: string | null, key: string): boolean {
  return existingKey !== key;
}

export function hardCapBlocks(opts: {
  allocated: number;
  used: number;
  reserve: number;
  hard: boolean;
}): boolean {
  return opts.hard && opts.used + opts.reserve >= opts.allocated;
}
