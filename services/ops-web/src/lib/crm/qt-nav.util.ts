import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeQtNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_quote', 'view') ||
    hasCap(user, 'crm_quote', 'view_all') ||
    hasCap(user, 'crm_board', 'view')
  );
}

export type QtNavItem = {
  id: 'overview' | 'list' | 'new' | 'catalog' | 'approvals' | 'reports' | 'settings';
  href: string;
  label: string;
};

export const QT_NAV: QtNavItem[] = [
  { id: 'overview', href: '/crm/proposals', label: 'Tổng quan' },
  { id: 'list', href: '/crm/proposals/list', label: 'Báo giá' },
  { id: 'new', href: '/crm/proposals/new', label: 'Tạo báo giá' },
  { id: 'catalog', href: '/crm/proposals/catalog', label: 'Service Catalog' },
  { id: 'approvals', href: '/crm/proposals/approvals', label: 'Phê duyệt' },
  { id: 'reports', href: '/crm/proposals/reports', label: 'Báo cáo' },
  { id: 'settings', href: '/crm/proposals/settings', label: 'Cấu hình' },
];

/** AE (view-only): hide create / catalog manage / approvals. */
export function qtNavForUser(user: StoredStaffUser | null | undefined): QtNavItem[] {
  const u = user ?? null;
  const canEdit = hasCap(u, 'crm_quote', 'edit') || hasCap(u, 'crm_quote', 'manage');
  const canApprove = hasCap(u, 'crm_quote.approve', 'execute');
  const canCatalog =
    hasCap(u, 'crm_quote.catalog', 'manage') || hasCap(u, 'crm_quote.catalog', 'edit');
  return QT_NAV.filter((item) => {
    if (item.id === 'new') return canEdit;
    if (item.id === 'approvals') return canApprove || canEdit;
    if (item.id === 'catalog') return canCatalog || canEdit;
    if (item.id === 'settings') return canEdit;
    return true;
  });
}

const QT_STATIC_SEGMENTS = new Set([
  'list',
  'new',
  'catalog',
  'approvals',
  'reports',
  'settings',
  'activity',
]);

export function qtNavIsActive(pathname: string, href: string): boolean {
  if (href === '/crm/proposals') return pathname === href;
  if (href === '/crm/proposals/new') {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    const match = pathname.match(/^\/crm\/proposals\/([^/]+)(?:\/.*)?$/);
    return Boolean(match && match[1] && !QT_STATIC_SEGMENTS.has(match[1]));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
