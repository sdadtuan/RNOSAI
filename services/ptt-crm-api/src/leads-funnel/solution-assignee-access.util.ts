/**
 * Who may act on a lead's Solution step (consult AI, AI tạo Solution, Nộp Solution cho Sales).
 *
 * Solution auto-assign / claim pool = active staff with HR "Nhận Solution"
 * (crm_staff.can_receive_solution). Position alone does not qualify.
 * Within the pool only the person assigned to this lead's Solution step may act on unassigned work.
 * SUPER-ADMIN is always allowed. The current assignee may act even if the flag was later unchecked.
 */
export function isSolutionPoolMember(input: { canReceiveSolution?: boolean }): boolean {
  return Boolean(input.canReceiveSolution);
}

function positiveId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The lead's Solution assignee. assigned_am is what "Phân công lại" (kind am/acm/solution) writes,
 * but it is seeded with the Sales owner when pre-sales is created, so it only counts once it
 * points at a pool member; otherwise fall back to solution_owner_staff_id.
 */
export function pickSolutionAssignee(input: {
  assignedAm: unknown;
  solutionOwnerStaffId: unknown;
  assignedAmInPool: boolean;
}): number | null {
  const am = positiveId(input.assignedAm);
  if (am != null && input.assignedAmInPool) return am;
  return positiveId(input.solutionOwnerStaffId);
}

export function canUseAssignedSolutionAction(input: {
  isSuperAdmin?: boolean;
  staffId: unknown;
  assigneeStaffId: unknown;
  isAccountManager?: boolean;
  canReceiveSolution?: boolean;
}): boolean {
  if (input.isSuperAdmin) return true;
  const me = positiveId(input.staffId);
  const assignee = positiveId(input.assigneeStaffId);
  if (me == null || assignee == null || me !== assignee) return false;
  return true;
}

export const NOT_SOLUTION_ASSIGNEE_MESSAGE =
  'Chỉ người được giao làm Solution của lead này (hoặc SUPER-ADMIN) mới được dùng chức năng này.';
