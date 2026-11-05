import type { ActualQuality } from './service-kpi-ledgers';

export type DuplicateDecision = 'skip' | 'merge' | 'correction';

export function detectDuplicateActual(
  existing: { periodStart: string; periodEnd: string; sourceRef: string; quality: ActualQuality } | null,
  incoming: { periodStart: string; periodEnd: string; sourceRef: string },
): 'ok' | 'duplicate' {
  if (!existing) return 'ok';
  if (
    existing.periodStart === incoming.periodStart &&
    existing.periodEnd === incoming.periodEnd &&
    existing.sourceRef === incoming.sourceRef
  ) {
    return 'duplicate';
  }
  return 'ok';
}

export function applyZeroDenominator(): { value: null; quality: 'na' } {
  return { value: null, quality: 'na' };
}
