import type { StoredStaffUser } from '@/lib/auth';
import { canSeeCpNav } from '@/lib/crm/cp-nav.util';

export function shouldShowCpNav(user: StoredStaffUser | null): boolean {
  return canSeeCpNav(user);
}
