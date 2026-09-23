export type B2bFlowKind = 'b2b_prospect' | 'spa_operational';

export interface B2bVisibilityActor {
  staffId: number;
  isDirector: boolean;
  hasViewAllLeads: boolean;
  isActivePttStaff: boolean;
}

export interface B2bLeadScopeRow {
  flowKind: B2bFlowKind;
  ownerId: number | null;
  projectId: string | null;
}

export type B2bProjectStaffRole = 'sales' | 'project_manager';

export interface B2bProjectMembership {
  projectId: string;
  assignEnabled: boolean;
  role?: B2bProjectStaffRole;
}

export function canSeeB2bLead(
  actor: B2bVisibilityActor,
  lead: B2bLeadScopeRow,
  memberships: B2bProjectMembership[],
): boolean {
  if (lead.flowKind !== 'b2b_prospect') return false;
  if (actor.hasViewAllLeads || actor.isDirector) return true;
  if (!actor.isActivePttStaff) return false;
  // AE / sales: only leads assigned to them.
  if (lead.ownerId != null && Number(lead.ownerId) === Number(actor.staffId)) return true;
  if (!lead.projectId) return false;
  // Project managers still see the whole project pool.
  return memberships.some(
    (m) => m.projectId === lead.projectId && m.role === 'project_manager',
  );
}

export function redactLeadIfDenied<T extends { full_name?: unknown; phone?: unknown }>(
  allowed: boolean,
  body: T,
): T | { error: 'not_found' } {
  if (allowed) return body;
  return { error: 'not_found' };
}
