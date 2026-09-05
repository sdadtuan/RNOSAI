import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeAmNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_am', 'view') || hasCap(user, 'crm_am', 'view_all');
}

export type AmNavItem = {
  href: string;
  label: string;
  group: 'TỔNG QUAN' | 'KHÁCH HÀNG' | 'CÔNG VIỆC' | 'HỢP ĐỒNG' | 'PHÂN TÍCH' | 'CẤU HÌNH';
};

export const AM_NAV: AmNavItem[] = [
  { group: 'TỔNG QUAN', href: '/crm/account-management', label: 'Dashboard' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/clients', label: 'Danh sách' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/onboarding', label: 'Onboarding' },
  { group: 'CÔNG VIỆC', href: '/crm/account-management/work', label: 'Work Queue' },
  { group: 'HỢP ĐỒNG', href: '/crm/account-management/renewals', label: 'Gia hạn' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/reports', label: 'Báo cáo' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/health', label: 'Health & Risk' },
  { group: 'CẤU HÌNH', href: '/crm/account-management/settings', label: 'Cấu hình' },
];
