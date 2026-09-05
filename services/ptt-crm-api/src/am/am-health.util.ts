import {
  ACTIVE_BOOK,
  AmAmStatus,
  AmHealthBand,
  AmHealthComponents,
  DEFAULT_WEIGHTS,
} from './am.types';

export { ACTIVE_BOOK, DEFAULT_WEIGHTS };
export type { AmAmStatus, AmHealthBand, AmHealthComponents };

export function bandFromScore(score: number): AmHealthBand {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
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
