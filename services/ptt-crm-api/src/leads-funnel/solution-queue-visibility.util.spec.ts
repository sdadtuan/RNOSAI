import {
  ownerOrSubmittedSolutionSql,
  releasedSolutionAssigneeMatchSql,
  submittedSolutionVisibleSql,
  submittedSolutionVisibleTo,
} from './solution-queue-visibility.util';

describe('submitted solution queue visibility', () => {
  const parties = {
    ownerId: 4,
    solutionAssigneeStaffId: 9,
  };

  it('keeps a submitted Solution for the lead assignee and the AM who was assigned to do it', () => {
    expect(submittedSolutionVisibleTo(4, parties)).toBe(true);
    expect(submittedSolutionVisibleTo(9, parties)).toBe(true);
  });

  it('does not show that submitted Solution to another AM or a stale owner id', () => {
    expect(submittedSolutionVisibleTo(12, parties)).toBe(false);
    expect(submittedSolutionVisibleTo(108, { ownerId: 1, solutionAssigneeStaffId: 9 })).toBe(false);
    expect(submittedSolutionVisibleTo(null, parties)).toBe(false);
  });

  it('matches the assignee from the Solution assignment log, not the raw owner columns', () => {
    const sql = submittedSolutionVisibleSql('l', 'ps', '$3');
    expect(sql).toContain('l.owner_id = $3');
    expect(sql).toContain("COALESCE(al.owner_kind, '') = 'solution'");
    expect(sql).toContain('al.to_owner_id = $3');
    expect(sql).toContain("'acm', 'kd-01', 'kd01'");
    expect(sql).toContain("'mkl', 'mkt-01', 'mkt01'");
    expect(sql).not.toContain('last_solution_owner_staff_id');
    expect(sql).not.toContain('solution_owner_staff_id');
    expect(sql).not.toContain('assigned_am');
    expect(releasedSolutionAssigneeMatchSql('l', '$3')).toContain('crm_lead_assignment_log');
  });

  it('keeps a submitted Solution on the Kanban list for the assignee or that AM', () => {
    const sql = ownerOrSubmittedSolutionSql('l', '$1');
    expect(sql).toContain('l.owner_id = $1');
    expect(sql).toContain("ps_sol.handoff_status = 'released'");
    expect(sql).toContain('ps_sol.solution_approved_at IS NULL');
    expect(sql).toContain("COALESCE(al.owner_kind, '') = 'solution'");
    expect(sql).toContain('al.to_owner_id = $1');
    expect(sql).not.toContain('last_solution_owner_staff_id');
    expect(sql).not.toContain('ps_sol.assigned_am');
  });
});
