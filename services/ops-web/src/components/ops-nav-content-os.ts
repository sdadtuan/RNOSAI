import { canViewContentOs, type StoredStaffUser } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';

export function shouldShowContentOsNav(user: StoredStaffUser | null): boolean {
  return isContentMarketingFeEnabled() && canViewContentOs(user);
}
