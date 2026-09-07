import { dash } from './cp-format';

export const PORTFOLIO_STATUS_CHIPS = [
  { id: 'all', label: 'Tất cả', status: '', scope: '' },
  { id: 'active', label: 'Active', status: 'active', scope: '' },
  { id: 'at_risk', label: 'At Risk', status: 'at_risk', scope: '' },
  { id: 'in_review', label: 'In Review', status: 'in_review', scope: '' },
  { id: 'me', label: 'Của tôi', status: '', scope: 'me' },
] as const;

export type PortfolioChipId = (typeof PORTFOLIO_STATUS_CHIPS)[number]['id'];

export type PortfolioStatusCounts = {
  all?: number;
  active?: number;
  at_risk?: number;
  in_review?: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  at_risk: 'At Risk',
  in_review: 'In Review',
  completed: 'Completed',
  archived: 'Archived',
};

export function formatDeliverableCount(
  done: number | null | undefined,
  total: number | null | undefined,
): string {
  const all = Number(total);
  if (!Number.isFinite(all) || all <= 0) return dash(null);
  return `${Number(done ?? 0)} / ${all}`;
}

export function formatCreditPct(
  used: number | null | undefined,
  budget: number | null | undefined,
): string {
  const cap = Number(budget);
  if (!Number.isFinite(cap) || cap <= 0) return dash(null);
  return `${Math.round((Number(used ?? 0) * 100) / cap)}%`;
}

export function portfolioStatusTone(
  status: string | null | undefined,
): 'ok' | 'warn' | 'info' | 'danger' | 'neutral' {
  if (status === 'active' || status === 'completed') return 'ok';
  if (status === 'at_risk') return 'warn';
  if (status === 'in_review' || status === 'draft') return 'info';
  return 'neutral';
}

export function portfolioStatusLabel(status: string | null | undefined): string {
  if (status == null || status === '') return dash(null);
  return STATUS_LABEL[status] ?? status;
}

export function formatPortfolioChip(
  id: PortfolioChipId | 'all' | 'active' | 'at_risk' | 'in_review',
  counts: PortfolioStatusCounts,
): string {
  const chip = PORTFOLIO_STATUS_CHIPS.find((item) => item.id === id);
  const label = chip?.label ?? id;
  if (id === 'me') return label;
  const count = id === 'all' ? counts.all : counts[id];
  return count == null ? label : `${label} (${count})`;
}

export function portfolioPillClass(status: string | null | undefined): string {
  const tone = portfolioStatusTone(status);
  if (tone === 'ok') return 'cp-pill cp-pill--ok';
  if (tone === 'warn') return 'cp-pill cp-pill--warning';
  if (tone === 'info') return 'cp-pill cp-pill--info';
  if (tone === 'danger') return 'cp-pill cp-pill--danger';
  return 'cp-pill';
}
