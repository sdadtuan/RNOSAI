import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { isCpImageSopVisible } from '@/lib/crm/cp-image-sop.flags';

export function shouldShowImageSopNav(user: StoredStaffUser | null, imageEnabled: boolean): boolean {
  if (!user) return false;
  return isCpImageSopVisible({ enabled: imageEnabled, router: 'manual' }, hasCap(user, 'crm_img', 'view'));
}
