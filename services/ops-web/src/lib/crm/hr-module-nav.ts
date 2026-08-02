import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildCrmHrModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  const links: ModuleNavLink[] = [];

  if (hasCap(user, 'crm_staff_roster', 'view')) {
    links.push({ href: '/crm/staff', label: 'Nhân viên' });
  }
  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    links.push({ href: '/crm/payroll', label: 'Chấm công & lương' });
  }

  return links;
}
