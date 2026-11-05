import { canViewImageSop, type StoredStaffUser } from '@/lib/auth';
import { isCpImageSopFeEnabled, isCpImageSopNavEnabled } from '@/lib/crm/cp-image-sop.flags';

export function shouldShowImageSopNav(user: StoredStaffUser | null, imageEnabled?: boolean): boolean {
  if (!canViewImageSop(user)) return false;
  return isCpImageSopNavEnabled({ enabled: imageEnabled ?? false, router: 'manual' });
}

export function shouldShowImageSopNavWithFe(user: StoredStaffUser | null): boolean {
  if (!canViewImageSop(user)) return false;
  return isCpImageSopFeEnabled();
}
