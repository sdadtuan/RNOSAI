import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeIwrNav(user: StoredStaffUser | null | undefined): boolean {
  return !!user && hasCap(user, 'iwr', 'view');
}
