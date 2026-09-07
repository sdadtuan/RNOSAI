import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeCpNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_cp', 'view') || hasCap(user, 'crm_cp', 'view_all');
}

export type CpNavItem = {
  id: 'overview' | 'projects' | 'video' | 'media' | 'brand' | 'calendar' | 'reports' | 'settings';
  href: string;
  label: string;
};

export const CP_NAV: CpNavItem[] = [
  { id: 'overview', href: '/crm/creative-os', label: 'Tổng quan' },
  { id: 'projects', href: '/crm/creative-os/projects', label: 'Dự án' },
  { id: 'video', href: '/crm/creative-os/video', label: 'Video AI' },
  { id: 'media', href: '/crm/creative-os/media', label: 'Thư viện' },
  { id: 'brand', href: '/crm/creative-os/brand-kits', label: 'Brand Kit' },
  { id: 'calendar', href: '/crm/creative-os/calendar', label: 'Lịch xuất bản' },
  { id: 'reports', href: '/crm/creative-os/reports', label: 'Báo cáo' },
  { id: 'settings', href: '/crm/creative-os/settings', label: 'Cấu hình' },
];
