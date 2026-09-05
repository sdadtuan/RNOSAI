import { bandCopy, dash, vnd, type AmHealthBand } from './am-format';

export const AM_HEALTH_BAND_KEYS = ['healthy', 'watch', 'at_risk', 'critical'] as const;

export type AmHealthTileKey =
  | (typeof AM_HEALTH_BAND_KEYS)[number]
  | 'revenue_at_risk'
  | 'open_risks';

export const AM_HEALTH_TILES: Array<{ key: AmHealthTileKey; label: string }> = [
  { key: 'healthy', label: 'Healthy' },
  { key: 'watch', label: 'Watch' },
  { key: 'at_risk', label: 'At Risk' },
  { key: 'critical', label: 'Critical' },
  { key: 'revenue_at_risk', label: 'Revenue at risk' },
  { key: 'open_risks', label: 'Open risks' },
];

export const AM_HEALTH_COMPONENT_LABELS: Record<string, string> = {
  kpi_delivery: 'KPI Delivery',
  engagement: 'Engagement',
  financial: 'Financial',
  satisfaction: 'Satisfaction',
  contract_support: 'Contract & Support',
};

export function amHealthEmpty(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amHealthMoney(hideAmounts: boolean, value: number | null | undefined): string {
  if (hideAmounts) return '—';
  return vnd(value);
}

export function amHealthDelta(delta: number | null | undefined): string {
  if (delta == null) return '—';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function amHealthTileValue(
  key: AmHealthTileKey,
  tiles: {
    healthy: number;
    watch: number;
    at_risk: number;
    critical: number;
    revenue_at_risk_vnd: number | null;
    open_risks: number;
  } | null,
  hideAmounts: boolean,
): string {
  if (!tiles) return '—';
  if (key === 'revenue_at_risk') return amHealthMoney(hideAmounts, tiles.revenue_at_risk_vnd);
  if (key === 'open_risks') return dash(tiles.open_risks);
  return dash(tiles[key]);
}

export function amHealthSparkHeight(avg: number | null | undefined): number {
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return 4;
  return Math.max(4, Math.min(100, avg));
}

export function amHealthBandLabel(band: AmHealthBand | null | undefined): string {
  return bandCopy(band);
}

export function amHealthRecoveryCopy(status: string | null | undefined): string {
  if (!status) return '—';
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Closed';
  return status;
}
