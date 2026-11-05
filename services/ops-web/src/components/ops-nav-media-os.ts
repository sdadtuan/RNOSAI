import { canViewMediaOs, type StoredStaffUser } from '@/lib/auth';
import { isMediaOsFeEnabled } from '@/lib/media-os-flags';

export function shouldShowMediaOsNav(user: StoredStaffUser | null): boolean {
  return isMediaOsFeEnabled() && canViewMediaOs(user);
}
