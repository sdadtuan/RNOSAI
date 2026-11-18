/**
 * After AM nộp Solution, handoff becomes `released` and the work queue
 * (pending / with_solution) would drop the lead. Keep it for two people only:
 * the lead assignee, and the AM the system actually assigned to do that
 * Solution (latest crm_lead_assignment_log owner_kind = solution, and that
 * person is an Account Manager or has Nhận Solution).
 *
 * solution_owner / last_solution_owner / assigned_am are not enough: assigned_am
 * is seeded with the Sales owner, and the pending handoff stamps those columns
 * before anyone has taken the case. A Marketing Leader is never that AM.
 */

export interface SubmittedSolutionParties {
  ownerId?: number | null;
  /** Latest Solution assignment (owner_kind = solution) when that person is an AM. */
  solutionAssigneeStaffId?: number | null;
}

function sameStaff(viewerStaffId: number, raw: number | null | undefined): boolean {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id === viewerStaffId;
}

export function submittedSolutionVisibleTo(
  viewerStaffId: number | null | undefined,
  row: SubmittedSolutionParties,
): boolean {
  const viewer = Number(viewerStaffId);
  if (!Number.isInteger(viewer) || viewer <= 0) return false;
  return sameStaff(viewer, row.ownerId) || sameStaff(viewer, row.solutionAssigneeStaffId);
}

/**
 * Latest Solution assignee who is an AM (ACM / KD-01) or flagged Nhận Solution.
 * Marketing Leader (MKL / MKT-01) does not match.
 * `param` is a bound staff id. `leadAlias` must expose sqlite_lead_id.
 */
export function releasedSolutionAssigneeMatchSql(leadAlias: string, param: string): string {
  const pos = `lower(replace(COALESCE(pos.code, ''), ' ', ''))`;
  return `EXISTS (
    SELECT 1
      FROM crm_lead_assignment_log al
      JOIN crm_staff st ON st.id = al.to_owner_id AND st.active IS TRUE
      LEFT JOIN crm_positions pos ON pos.id = st.position_id
     WHERE al.sqlite_lead_id = ${leadAlias}.sqlite_lead_id
       AND COALESCE(al.owner_kind, '') = 'solution'
       AND al.to_owner_id = ${param}
       AND ${pos} NOT IN ('mkl', 'mkt-01', 'mkt01')
       AND (
         ${pos} IN ('acm', 'kd-01', 'kd01')
         OR COALESCE(st.can_receive_solution, FALSE) IS TRUE
       )
       AND al.created_at = (
         SELECT MAX(al2.created_at)
           FROM crm_lead_assignment_log al2
          WHERE al2.sqlite_lead_id = ${leadAlias}.sqlite_lead_id
            AND COALESCE(al2.owner_kind, '') = 'solution'
       )
  )`;
}

/** SQL twin of submittedSolutionVisibleTo. `param` is a bound staff id placeholder. */
export function submittedSolutionVisibleSql(leadAlias: string, _presalesAlias: string, param: string): string {
  return `(
    ${leadAlias}.owner_id = ${param}
    OR ${releasedSolutionAssigneeMatchSql(leadAlias, param)}
  )`;
}

/**
 * List/Kanban scope for a staff member who does not see every lead.
 * Own leads, plus a Solution already nộp (handoff released, khách chưa duyệt)
 * when they are the AM assigned to do it.
 */
export function ownerOrSubmittedSolutionSql(leadAlias: string, param: string): string {
  return `(
    ${leadAlias}.owner_id = ${param}
    OR EXISTS (
      SELECT 1 FROM crm_lead_presales ps_sol
      WHERE ps_sol.lead_id = ${leadAlias}.sqlite_lead_id
        AND COALESCE(ps_sol.status, '') = 'active'
        AND ps_sol.handoff_status = 'released'
        AND ps_sol.solution_approved_at IS NULL
        AND ${releasedSolutionAssigneeMatchSql(leadAlias, param)}
    )
  )`;
}
