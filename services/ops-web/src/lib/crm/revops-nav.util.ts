import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeRevopsNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_revops', 'view') ||
    hasCap(user, 'crm_revops', 'view_team') ||
    hasCap(user, 'crm_revops', 'view_all') ||
    hasCap(user, 'crm_revops', 'manage')
  );
}

export type RevopsNavItem = { id: string; label: string; href: string; icon: string };
export type RevopsNavGroup = { title: string; items: RevopsNavItem[] };

export const REVOPS_NAV_GROUPS: RevopsNavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [{ id: 'dashboard', label: 'Command Center', href: '/crm/revenue-ops', icon: 'command' }],
  },
  {
    title: 'DOANH THU',
    items: [
      { id: 'leads', label: 'Leads & Routing', href: '/crm/leads?revops=1', icon: 'leads' },
      { id: 'pipeline', label: 'Pipeline & Deal', href: '/crm/revenue-ops/pipeline', icon: 'pipeline' },
      {
        id: 'accounts',
        label: 'Account 360',
        href: '/crm/account-management/clients?revops=1',
        icon: 'accounts',
      },
      {
        id: 'handover',
        label: 'Handover & Onboarding',
        href: '/crm/account-management/onboarding?revops=1',
        icon: 'handover',
      },
      {
        id: 'renewal',
        label: 'Renewal & Growth',
        href: '/crm/account-management/renewals?revops=1',
        icon: 'renewal',
      },
    ],
  },
  {
    title: 'HIỆU SUẤT',
    items: [
      { id: 'kpi', label: 'KPI & Hoa hồng', href: '/crm/kpi-hub/sales?revops=1', icon: 'kpi' },
      { id: 'sla', label: 'SLA & Escalation', href: '/crm/revenue-ops/sla', icon: 'sla' },
      { id: 'reports', label: 'Báo cáo & Forecast', href: '/crm/revenue-ops/reports', icon: 'reports' },
    ],
  },
  {
    title: 'QUẢN TRỊ',
    items: [
      { id: 'territory', label: 'Territory & Capacity', href: '/crm/revenue-ops/territory', icon: 'territory' },
      { id: 'approvals', label: 'Phê duyệt', href: '/crm/revenue-ops/approvals', icon: 'approvals' },
      { id: 'settings', label: 'Cấu hình & Audit', href: '/crm/revenue-ops/settings', icon: 'settings' },
    ],
  },
];

export const REVOPS_MOBILE_NAV: RevopsNavItem[] = [
  REVOPS_NAV_GROUPS[0].items[0],
  REVOPS_NAV_GROUPS[1].items[0],
  REVOPS_NAV_GROUPS[1].items[1],
  REVOPS_NAV_GROUPS[1].items[2],
  REVOPS_NAV_GROUPS[2].items[0],
];

export function activeRevopsHref(pathname: string): string {
  const items = REVOPS_NAV_GROUPS.flatMap((g) => g.items);
  const exact = items.find((i) => i.href.split('?')[0] === pathname);
  if (exact) return exact.href;
  if (pathname.startsWith('/crm/leads')) return '/crm/leads?revops=1';
  if (pathname.startsWith('/crm/account-management/onboarding')) {
    return '/crm/account-management/onboarding?revops=1';
  }
  if (pathname.startsWith('/crm/account-management/renewals')) {
    return '/crm/account-management/renewals?revops=1';
  }
  if (pathname.startsWith('/crm/account-management')) {
    return '/crm/account-management/clients?revops=1';
  }
  if (pathname.startsWith('/crm/kpi-hub')) return '/crm/kpi-hub/sales?revops=1';
  const nested = items
    .filter((i) => pathname.startsWith(i.href.split('?')[0]) && i.href !== '/crm/revenue-ops')
    .sort((a, b) => b.href.length - a.href.length)[0];
  return nested?.href ?? '/crm/revenue-ops';
}
