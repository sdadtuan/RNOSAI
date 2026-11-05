import { vnd } from './am-format';

export const AM_REPORT_FORMULAS = {
  logo: 'Logo = remaining_end / start_set          (new logos excluded from denominator)',
  grr: 'GRR  = (Start − Churn − Contraction) / Start',
  nrr: 'NRR  = (Start − Churn − Contraction + Expansion) / Start',
} as const;

export const AM_REPORT_NRR_HIDDEN_NOTE =
  'Thiếu phân loại expansion — NRR được ẩn. Logo Retention vẫn hiển thị.';

export const AM_REPORT_EXPORT_TOOLTIP = 'Export >10k sẽ làm bất đồng bộ — chưa mở';

export function amReportsHideNrrNote(): string {
  return AM_REPORT_NRR_HIDDEN_NOTE;
}

export function amReportsDrillHref(opts: {
  report: string;
  from: string;
  to: string;
  scope?: string;
  cohort?: string;
  cell?: string;
  forecast?: string;
  reason?: string;
  owner?: string | number | null;
}): string {
  const params = new URLSearchParams();
  params.set('from', opts.from);
  params.set('to', opts.to);
  if (opts.scope) params.set('scope', opts.scope);
  params.set('report', opts.report);
  if (opts.cohort) params.set('cohort', opts.cohort);
  if (opts.cell) params.set('period', opts.cell);
  if (opts.forecast) params.set('forecast', opts.forecast);
  if (opts.reason) params.set('reason', opts.reason);
  if (opts.owner === null) params.set('owner', 'unassigned');
  else if (opts.owner != null && opts.owner !== '') params.set('owner', String(opts.owner));
  return `/crm/account-management/clients?${params.toString()}`;
}

export function amReportsFormatRate(n: number | null | undefined): string {
  if (n == null) return '—';
  const pct = n * 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${text}%`;
}

export function amReportsMoney(n: number | null | undefined): string {
  return vnd(n);
}

export function amReportsHeatClass(rate: number | null | undefined): string {
  if (rate == null) return 'am-reports-heat--empty';
  if (rate >= 0.9) return 'am-reports-heat--hi';
  if (rate >= 0.7) return 'am-reports-heat--mid';
  return 'am-reports-heat--lo';
}

export function amReportsForecastWidth(
  value: number | null | undefined,
  total: number,
): number {
  if (value == null || total <= 0) return 0;
  return Math.max(0, Math.round((value / total) * 100));
}
