export type KpiHubNavIcon =
  | 'dashboard'
  | 'book'
  | 'target'
  | 'database'
  | 'shield'
  | 'chart'
  | 'gear';

export type KpiHubNavItem = {
  href: string;
  label: string;
  icon: KpiHubNavIcon;
};

export const KPI_HUB_NAV: KpiHubNavItem[] = [
  { href: '/crm/kpi-hub', label: 'Dashboard', icon: 'dashboard' },
  { href: '/crm/kpi-hub/dictionary', label: 'KPI Dictionary', icon: 'book' },
  { href: '/crm/kpi-hub/targets', label: 'Target & Cảnh báo', icon: 'target' },
  { href: '/crm/kpi-hub/sources', label: 'Nguồn dữ liệu', icon: 'database' },
  { href: '/crm/kpi-hub/quality', label: 'Data Quality', icon: 'shield' },
  { href: '/crm/kpi-hub/reports', label: 'Báo cáo', icon: 'chart' },
  { href: '/crm/kpi-hub/settings', label: 'Cài đặt', icon: 'gear' },
];

export function isKpiHubPath(pathname: string): boolean {
  return pathname === '/crm/kpi-hub' || pathname.startsWith('/crm/kpi-hub/');
}

export function activeKpiHubHref(pathname: string): string {
  const match = [...KPI_HUB_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.href ?? '/crm/kpi-hub';
}
