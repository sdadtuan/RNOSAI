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

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function formatLedgerDisplay(
  kind: 'quoted' | 'assigned' | 'verified',
  input: {
    value: number | null;
    label: LedgerCell['label'];
    pendingActual?: number | null;
    unit?: string;
  },
): string {
  const unit = input.unit ?? 'CPL';
  if (kind === 'verified' && input.label === 'Pending') {
    const val = input.pendingActual ?? input.value;
    if (val != null) return `${formatK(val)} · Pending`;
    return 'Pending';
  }
  if (input.value == null) return 'Pending';
  if (kind === 'quoted' || kind === 'assigned') return `≤${formatK(input.value)} ${unit}`;
  return `${formatK(input.value)} ${unit}`;
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
