import type { StoredStaffUser } from './auth';
import { hasAnyCap, resolvePathCapRequirements } from './rbac-routes';

export type KpiHubNavIcon =
  | 'dashboard'
  | 'book'
  | 'target'
  | 'database'
  | 'shield'
  | 'chart'
  | 'gear'
  | 'inbox'
  | 'list'
  | 'template'
  | 'layers'
  | 'plan'
  | 'track'
  | 'check'
  | 'users';

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
    id: 'service-kpi',
    label: 'SERVICE KPI',
    items: [
      { href: '/crm/kpi-hub/service-kpi', label: 'War Room', icon: 'dashboard' },
      { href: '/crm/kpi-hub/service-templates', label: 'Service KPI Template', icon: 'template' },
      { href: '/crm/kpi-hub/instances', label: 'KPI Instances', icon: 'layers' },
      { href: '/crm/kpi-hub/measurement', label: 'Measurement Plan', icon: 'plan' },
      { href: '/crm/kpi-hub/tracking', label: 'Actual Tracking', icon: 'track' },
      { href: '/crm/kpi-hub/kpi-contracts', label: 'KPI Contract & Risk', icon: 'shield' },
      { href: '/crm/kpi-hub/reconcile', label: 'Quoted vs Actual', icon: 'list' },
      { href: '/crm/kpi-hub/policy-packs', label: 'Policy Pack', icon: 'book' },
    ],
  },
  {
    id: 'performance',
    label: 'HIỆU SUẤT',
    items: [
      { href: '/crm/kpi-hub/performance', label: 'Operating Dashboard', icon: 'dashboard' },
      { href: '/crm/kpi-hub/performance/assignments', label: 'Assignment Registry', icon: 'list' },
      { href: '/crm/kpi-hub/performance/assignments/new', label: 'Tạo Assignment', icon: 'layers' },
      { href: '/crm/kpi-hub/performance/scorecards', label: 'Scorecard Builder', icon: 'template' },
      { href: '/crm/kpi-hub/performance/scorecards/items', label: 'Thêm chỉ tiêu', icon: 'target' },
      { href: '/crm/kpi-hub/performance/check-ins', label: 'Check-in Ritual', icon: 'check' },
      { href: '/crm/kpi-hub/performance/marketing', label: 'Marketing OS', icon: 'chart' },
      { href: '/crm/kpi-hub/performance/campaigns', label: 'Campaign Control', icon: 'track' },
      { href: '/crm/kpi-hub/performance/crm-source', label: 'CRM Source Map', icon: 'database' },
      { href: '/crm/kpi-hub/performance/reports', label: 'Snapshot Report', icon: 'chart' },
      { href: '/crm/kpi-hub/performance/settings', label: 'Policy', icon: 'gear' },
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

export const SERVICE_KPI_NAV_GROUP: KpiHubNavGroup =
  KPI_HUB_NAV_GROUPS.find((g) => g.id === 'service-kpi') ?? KPI_HUB_NAV_GROUPS[2]!;

export function kpiHubNavGroup(id: string): KpiHubNavGroup | undefined {
  return KPI_HUB_NAV_GROUPS.find((g) => g.id === id);
}

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

/** Hide sidebar links the user cannot open (path caps from rbac-routes). */
export function filterKpiHubNavGroupsForUser(
  groups: KpiHubNavGroup[],
  user: StoredStaffUser | null,
): KpiHubNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const reqs = resolvePathCapRequirements(item.href);
        return !reqs.length || hasAnyCap(user, reqs);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function kpiHubNavGroupsForUser(
  user: StoredStaffUser | null,
  pathname?: string,
): KpiHubNavGroup[] {
  const base = pathname?.startsWith('/crm/delivery-projects')
    ? kpiHubNavGroupsWithDelivery()
    : KPI_HUB_NAV_GROUPS;
  return filterKpiHubNavGroupsForUser(base, user);
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
