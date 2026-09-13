import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export const MSOS_CHILD_SECTIONS = [
  'crm_media.inventory',
  'crm_media.packages',
  'crm_media.campaigns',
  'crm_media.evidence',
  'crm_media.outcomes',
  'crm_media.margin',
  'crm_media.settings',
] as const;

export const REVOPS_CHILD_SECTIONS = [
  'crm_revops.pipeline',
  'crm_revops.sla',
  'crm_revops.reports',
  'crm_revops.territory',
  'crm_revops.approvals',
  'crm_revops.settings',
] as const;

export const AM_CHILD_SECTIONS = [
  'crm_am.clients',
  'crm_am.onboarding',
  'crm_am.work',
  'crm_am.renewals',
  'crm_am.health',
  'crm_am.reports',
  'crm_am.opportunities',
  'crm_am.feedback',
  'crm_am.settings',
] as const;

export function hasCapOnParentOrChild(
  user: StoredStaffUser | null | undefined,
  parentId: string,
  action: string,
  childIds: readonly string[],
): boolean {
  if (!user) return false;
  if (hasCap(user, parentId, action)) return true;
  return childIds.some((id) => hasCap(user, id, action));
}
