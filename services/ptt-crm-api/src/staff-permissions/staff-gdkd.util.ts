import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { capAllows } from '../staff-client-scope/staff-client-scope.util';

export const CRM_GDKD_SECTION = 'crm_gdkd';

export type GdkdCapAction = 'override' | 'assign' | 'review_queue' | 'view_all_leads';

/** R2-A — check crm_gdkd.* with legacy crm_leads.assign bridge. */
export function hasGdkdCap(caps: StaffSectionCap[], action: GdkdCapAction): boolean {
  if (capAllows(caps, CRM_GDKD_SECTION, action)) return true;
  if (action === 'assign' || action === 'override') {
    return capAllows(caps, 'crm_leads', 'assign');
  }
  return false;
}

export function hasGdkdAssign(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'assign');
}

export function hasGdkdOverride(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'override');
}

export function hasGdkdViewAllLeads(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'view_all_leads');
}

export function hasGdkdReviewQueue(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'review_queue');
}

/**
 * True GĐKD/CEO desk for Solution claim/release override.
 * Does NOT treat crm_leads.assign alone (AE historically had assign).
 */
export function hasGdkdSolutionDesk(caps: StaffSectionCap[]): boolean {
  return (
    hasGdkdViewAllLeads(caps) ||
    capAllows(caps, CRM_GDKD_SECTION, 'assign') ||
    capAllows(caps, CRM_GDKD_SECTION, 'override')
  );
}
