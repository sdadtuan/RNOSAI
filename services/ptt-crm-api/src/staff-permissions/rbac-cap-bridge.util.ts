export type StaffCapRow = { section: string; action: string };

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
  caps: StaffCapRow[] | undefined,
  parentId: string,
  action: string,
  childIds: readonly string[],
): boolean {
  if (!caps?.length) return false;
  if (caps.some((c) => c.section === parentId && c.action === action)) return true;
  return childIds.some((id) => caps.some((c) => c.section === id && c.action === action));
}
