import {
  ACTIVE_BOOK,
  AmAmStatus,
  AmHealthBand,
  AmHealthComponents,
  DEFAULT_WEIGHTS,
} from './am.types';

export { ACTIVE_BOOK, DEFAULT_WEIGHTS };
export type { AmAmStatus, AmHealthBand, AmHealthComponents };

export type AmBandRanges = {
  healthy: [number, number];
  watch: [number, number];
  at_risk: [number, number];
  critical: [number, number];
};

export const DEFAULT_BANDS: AmBandRanges = {
  healthy: [80, 100],
  watch: [60, 79],
  at_risk: [40, 59],
  critical: [0, 39],
};

const BAND_KEYS: AmHealthBand[] = ['healthy', 'watch', 'at_risk', 'critical'];

export function bandFromScore(score: number, bands: AmBandRanges = DEFAULT_BANDS): AmHealthBand {
  for (const key of BAND_KEYS) {
    const [lo, hi] = bands[key];
    if (score >= lo && score <= hi) return key;
  }
  if (score > 100) return 'healthy';
  return 'critical';
}

export function weightedScore(
  components: AmHealthComponents,
  weights: AmHealthComponents = DEFAULT_WEIGHTS,
): number {
  const w = weights;
  return (
    (components.kpi_delivery * w.kpi_delivery +
      components.engagement * w.engagement +
      components.financial * w.financial +
      components.satisfaction * w.satisfaction +
      components.contract_support * w.contract_support) /
    100
  );
}

export function isActiveBook(status: AmAmStatus): boolean {
  return ACTIVE_BOOK.includes(status);
}
