import { canSeeCpNav, type StoredStaffUser } from '@/lib/crm/cp-nav.util';

export function shouldShowCpNav(user: StoredStaffUser | null): boolean {
  return canSeeCpNav(user);
}
