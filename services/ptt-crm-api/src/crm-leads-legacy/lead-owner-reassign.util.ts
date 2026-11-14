export const LEAD_OWNER_REASSIGN_KINDS = ['sales', 'am', 'acm', 'solution', 'quote_am'] as const;

export type LeadOwnerReassignKind = (typeof LEAD_OWNER_REASSIGN_KINDS)[number];

export type PresalesOwnerColumn =
  | 'assigned_am'
  | 'solution_owner_staff_id'
  | 'quote_assignee_staff_id';

export function isLeadOwnerReassignKind(value: string): value is LeadOwnerReassignKind {
  return (LEAD_OWNER_REASSIGN_KINDS as readonly string[]).includes(value);
}

/** Column on crm_lead_presales for a non-sales owner kind; null for sales. */
export function presalesOwnerColumn(kind: LeadOwnerReassignKind): PresalesOwnerColumn | null {
  if (kind === 'sales') return null;
  if (kind === 'am' || kind === 'acm' || kind === 'solution') return 'assigned_am';
  return 'quote_assignee_staff_id';
}