import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

/** Sidebar + route guard parity — csd cap or agency staff fallback. */
export function canSeeCsdNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  if (hasCap(user, 'csd', 'view')) return true;
  return hasCap(user, 'crm_agency', 'view');
}
