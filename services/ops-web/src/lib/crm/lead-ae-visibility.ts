import type { StoredStaffUser } from '@/lib/auth';
import type { LeadAssignmentLogRow, LeadAuditBundle, LeadStatusLogRow } from '@/lib/api';

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Position badge "AE · sales". GDKD and other sales desks keep a different code. */
export function isAccountExecutive(user: StoredStaffUser | null): boolean {
  const code = norm(user?.position_code).replace(/\s+/g, '');
  return code === 'ae' || code.startsWith('ae-') || code.startsWith('ae_');
}

function actorIsViewer(actor: string, user: StoredStaffUser): boolean {
  const value = norm(actor);
  if (!value) return false;
  const email = norm(user.email);
  const name = norm(user.display_name);
  const staffId = String(user.id ?? '').trim();
  return value === email || value === name || (staffId !== '' && value === staffId);
}

function statusRelated(row: LeadStatusLogRow, user: StoredStaffUser): boolean {
  return actorIsViewer(row.changed_by, user);
}

function assignmentRelated(row: LeadAssignmentLogRow, user: StoredStaffUser): boolean {
  const staffId = Number(user.id);
  if (Number.isFinite(staffId) && staffId > 0 && (row.from_user_id === staffId || row.to_user_id === staffId)) {
    return true;
  }
  if (actorIsViewer(row.created_by, user)) return true;
  const name = norm(user.display_name);
  if (!name) return false;
  return norm(row.from_name) === name || norm(row.to_name) === name;
}

/** AE sees only rows that name them. An empty result hides the panel. Other roles see the full log. */
export function leadAuditForViewer(
  audit: LeadAuditBundle | null,
  user: StoredStaffUser | null,
): LeadAuditBundle | null {
  if (!isAccountExecutive(user)) return audit;
  if (!audit || !user) return null;
  const status_logs = audit.status_logs.filter((row) => statusRelated(row, user));
  const assignment_logs = audit.assignment_logs.filter((row) => assignmentRelated(row, user));
  if (status_logs.length === 0 && assignment_logs.length === 0) return null;
  return { status_logs, assignment_logs };
}
