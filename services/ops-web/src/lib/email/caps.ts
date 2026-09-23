import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { emailGateAEnabled, emailModuleEnabled } from '@/lib/email-flags';

/** Email Marketing hub — explicit crm_email_mkt only (not crm_agency.view). */
export function canViewEmailHub(user: StoredStaffUser | null): boolean {
  if (!user || !emailModuleEnabled()) return false;
  return hasCap(user, 'crm_email_mkt', 'view');
}

export function canWriteEmailHub(user: StoredStaffUser | null): boolean {
  if (!user || !emailModuleEnabled()) return false;
  return hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');
}

export function canViewEmailGateA(user: StoredStaffUser | null): boolean {
  if (!user || !emailModuleEnabled() || !emailGateAEnabled()) return false;
  return hasCap(user, 'crm_email_mkt', 'settings') || hasCap(user, 'crm_email_mkt', 'view');
}
