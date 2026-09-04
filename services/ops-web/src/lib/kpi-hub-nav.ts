export type KpiHubNavIcon =
  | 'dashboard'
  | 'book'
  | 'target'
  | 'database'
  | 'shield'
  | 'chart'
  | 'gear'
  | 'inbox'
  | 'list';

export type KpiHubNavItem = {
  href: string;
  label: string;
  icon: KpiHubNavIcon;
};

export type KpiHubNavGroup = { id: string; label: string; items: KpiHubNavItem[] };

export const KPI_HUB_NAV_GROUPS: KpiHubNavGroup[] = [
  {
    id: 'overview',
    label: 'TỔNG QUAN',
    items: [
      { href: '/crm/kpi-hub/executive', label: 'Executive Command Center', icon: 'dashboard' },
      { href: '/crm/kpi-hub/marketing', label: 'Marketing Performance', icon: 'chart' },
      { href: '/crm/kpi-hub/sales', label: 'Sales Command Center', icon: 'target' },
    ],
  },
  {
    id: 'governance',
    label: 'GOVERNANCE',
    items: [
      { href: '/crm/kpi-hub/dictionary', label: 'KPI Dictionary', icon: 'book' },
      { href: '/crm/kpi-hub/targets', label: 'Target & Cảnh báo', icon: 'target' },
      { href: '/crm/kpi-hub/sources', label: 'Nguồn dữ liệu', icon: 'database' },
      { href: '/crm/kpi-hub/quality', label: 'Data Quality', icon: 'shield' },
      { href: '/crm/kpi-hub/approvals', label: 'Approval Center', icon: 'inbox' },
    ],
  },
  {
    id: 'analysis',
    label: 'PHÂN TÍCH',
    items: [
      { href: '/crm/kpi-hub/reports', label: 'Báo cáo', icon: 'chart' },
      { href: '/crm/kpi-hub/audit', label: 'Audit Log', icon: 'list' },
      { href: '/crm/kpi-hub/settings', label: 'Cài đặt', icon: 'gear' },
    ],
  },
];

export const KPI_HUB_NAV: KpiHubNavItem[] = KPI_HUB_NAV_GROUPS.flatMap((g) => g.items);

export function isKpiHubPath(pathname: string): boolean {
  return (
    pathname === '/crm/kpi-hub' ||
    pathname.startsWith('/crm/kpi-hub/') ||
    pathname === '/crm/delivery-projects' ||
    pathname.startsWith('/crm/delivery-projects/')
  );
}

export function activeKpiHubHref(pathname: string): string {
  const match = [...KPI_HUB_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (match) return match.href;
  if (pathname === '/crm/delivery-projects' || pathname.startsWith('/crm/delivery-projects/')) {
    return '/crm/delivery-projects';
  }
  return '/crm/kpi-hub/executive';
}

/** Wave B: append Project Delivery to overview group without replacing command centers. */
export function kpiHubNavGroupsWithDelivery(): KpiHubNavGroup[] {
  return KPI_HUB_NAV_GROUPS.map((g) => {
    if (g.id !== 'overview') return g;
    const hasDelivery = g.items.some((i) => i.href === '/crm/delivery-projects');
    if (hasDelivery) return g;
    return {
      ...g,
      items: [...g.items, { href: '/crm/delivery-projects', label: 'Project Delivery', icon: 'dashboard' as const }],
    };
  });
}
