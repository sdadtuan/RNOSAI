import { vnd } from './am-format';

export const AM_OPP_STAGES = ['qualify', 'propose', 'negotiate', 'won', 'lost'] as const;
export type AmOppStage = (typeof AM_OPP_STAGES)[number];

export const AM_OPP_STAGE_LABELS: Record<AmOppStage, string> = {
  qualify: 'Qualify',
  propose: 'Propose',
  negotiate: 'Negotiate',
  won: 'Won',
  lost: 'Lost',
};

export const AM_OPP_KIND_OPTS = [
  { value: '', label: '—' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'cross-sell', label: 'Cross-sell' },
  { value: 'new', label: 'New' },
  { value: 'other', label: 'Khác' },
] as const;

export type AmGrowthKpis = {
  pipeline_vnd: number | null;
  weighted_vnd: number | null;
  won_month_vnd: number | null;
};

export function amGrowthOpenStages(): AmOppStage[] {
  return ['qualify', 'propose', 'negotiate'];
}

export function amGrowthWeighted(
  value: number | null | undefined,
  probability: number | null | undefined,
): number | null {
  if (value == null || probability == null) return null;
  return (value * probability) / 100;
}

export function amGrowthMoney(n: number | null | undefined): string {
  return vnd(n);
}

export function amGrowthEmpty(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amGrowthStageLabel(stage: string | null | undefined): string {
  if (stage && (AM_OPP_STAGES as readonly string[]).includes(stage)) {
    return AM_OPP_STAGE_LABELS[stage as AmOppStage];
  }
  return '—';
}

export function amGrowthKpiSubtitle(kpis: AmGrowthKpis): string {
  if (kpis.pipeline_vnd == null && kpis.weighted_vnd == null && kpis.won_month_vnd == null) {
    return '—';
  }
  return `Pipeline: ${amGrowthMoney(kpis.pipeline_vnd)} · Weighted: ${amGrowthMoney(kpis.weighted_vnd)} · Won tháng này: ${amGrowthMoney(kpis.won_month_vnd)}`;
}

export function parseAmOppStage(raw: string | null | undefined): AmOppStage | '' {
  if (!raw) return '';
  return (AM_OPP_STAGES as readonly string[]).includes(raw) ? (raw as AmOppStage) : '';
}
