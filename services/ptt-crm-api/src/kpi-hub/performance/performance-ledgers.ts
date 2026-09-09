export type LedgerQuality = 'verified' | 'pending' | 'stale';

export type LedgerCell = {
  value: number | null;
  label: 'Quoted' | 'Assigned' | 'Verified' | 'Pending';
};

export function quotedDeltaPct(
  quoted: number | null,
  compare: number | null,
): number | null {
  if (quoted == null || compare == null || quoted === 0) return null;
  return Math.round(((compare - quoted) / quoted) * 1000) / 10;
}

export function isMaterialQuotedDelta(deltaPct: number | null, threshold = 10): boolean {
  return deltaPct != null && Math.abs(deltaPct) > threshold;
}

export function buildLedgers(input: {
  quoted_target: number | null;
  assigned_target: number | null;
  verified_actual: number | null;
  pending_actual?: number | null;
  quality: LedgerQuality;
}): { quoted: LedgerCell; assigned: LedgerCell; verified: LedgerCell } {
  const isVerified = input.quality === 'verified';
  return {
    quoted: { value: input.quoted_target, label: 'Quoted' },
    assigned: { value: input.assigned_target, label: 'Assigned' },
    verified: {
      value: isVerified ? input.verified_actual : null,
      label: isVerified ? 'Verified' : 'Pending',
    },
  };
}
