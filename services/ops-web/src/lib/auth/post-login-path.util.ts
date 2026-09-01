import type { StoredStaffUser } from '@/lib/auth';
import { ceoCommandEnabled } from '@/lib/crm/ceo-command-flags';
import { canSeeCeoNav } from '@/lib/crm/ceo-command-thread.util';

export function isCeoPosition(user: StoredStaffUser | null | undefined): boolean {
  return user?.position_code?.trim().toUpperCase() === 'CEO';
}

/** Default landing after staff login when no explicit ?next= is provided. */
export function resolveStaffPostLoginPath(
  user: StoredStaffUser,
  next?: string | null,
): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  if (isCeoPosition(user) && ceoCommandEnabled() && canSeeCeoNav(user)) {
    return '/crm/ceo';
  }
  return '/';
}
