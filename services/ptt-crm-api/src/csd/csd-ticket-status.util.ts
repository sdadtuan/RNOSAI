import type { CsdScopeStatus, CsdTicketStatus } from './csd.types';

const TRANSITIONS: Record<CsdTicketStatus, CsdTicketStatus[]> = {
  draft: ['new', 'cancelled'],
  new: ['triaged', 'assigned', 'cancelled', 'rejected'],
  triaged: ['assigned', 'waiting_for_client', 'rejected'],
  assigned: ['in_progress', 'waiting_for_client', 'on_hold'],
  in_progress: ['waiting_for_client', 'waiting_for_internal_approval', 'on_hold', 'resolved', 'escalated'],
  waiting_for_client: ['in_progress', 'on_hold', 'cancelled'],
  waiting_for_internal_approval: ['in_progress', 'rejected'],
  on_hold: ['in_progress', 'cancelled'],
  resolved: ['client_acceptance', 'reopened', 'closed'],
  client_acceptance: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress'],
  escalated: ['in_progress', 'assigned'],
  cancelled: [],
  rejected: [],
};

export function canTransitionTicket(from: CsdTicketStatus, to: CsdTicketStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function canStartWork(scope: CsdScopeStatus, scopeApproved: boolean): boolean {
  if (scope === 'out_of_scope') return false;
  if (scope === 'billable' || scope === 'included_by_exception') return scopeApproved;
  return true;
}
