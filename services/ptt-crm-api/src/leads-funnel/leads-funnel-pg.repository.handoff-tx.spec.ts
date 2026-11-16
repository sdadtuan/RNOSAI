import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeRepo(opts: { pool: number[]; assignedAm?: number; lockedHandoff?: string; failOn?: RegExp }) {
  const repo = new LeadsFunnelPgRepository({ databaseUrl: 'postgres://unused' } as never);
  const client = {
    query: jest.fn(async (sql: string) => {
      if (opts.failOn?.test(sql)) throw new Error('boom');
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              handoff_status: opts.lockedHandoff ?? '',
              assigned_am: opts.assignedAm ?? 2,
              last_solution_owner_staff_id: null,
            },
          ],
        };
      }
      if (sql.includes('FROM crm_staff s')) return { rows: opts.pool.map((id) => ({ id })) };
      if (sql.includes('FROM crm_lead_assignment_log')) return { rows: [] };
      if (sql.includes('RETURNING *')) return { rows: [{ id: 7, lead_id: 121 }] };
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const db = { connect: jest.fn(async () => client), query: jest.fn(async () => ({ rows: [] })) };
  const r = repo as any;
  r.pool = db;
  jest.spyOn(repo, 'getPresalesRowByLeadId').mockResolvedValue({
    id: 7, stage: 'lead', handoff_status: '', assigned_am: 2, last_solution_owner_staff_id: null, service_slug: '',
  } as never);
  jest.spyOn(repo, 'buildConsultAdvanceGate').mockResolvedValue({ ok: true, requires_confirm: false, messages: [] } as never);
  r.staffIsEligibleSolutionOwner = jest.fn(async (id: number) => opts.pool.includes(id));
  r.hasAssignmentLogOwnerKind = jest.fn(async () => true);
  r.applyPresalesConsultPrefill = jest.fn(async () => undefined);
  r.promoteLeadStatusOnSolutionHandoff = jest.fn(async () => undefined);
  r.currentLeadStatus = jest.fn(async () => 'dang_tu_van');
  r.noteLeadStep = jest.fn(async () => undefined);
  r.mapPresalesRow = jest.fn((row: unknown) => row);
  const sql = () => client.query.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());
  return { repo, r, client, db, sql };
}

describe('handoffToSolution: auto-assign and handoff share one transaction', () => {
  it('assigns a pool member and writes the handoff on the same client, then commits', async () => {
    const { repo, r, client, db, sql } = makeRepo({ pool: [108] });
    await repo.handoffToSolution(121, 5);
    const calls = sql();
    const idx = (re: RegExp) => calls.findIndex((s) => re.test(s));
    expect(calls[0]).toBe('BEGIN');
    expect(idx(/FOR UPDATE/)).toBe(1);
    expect(idx(/pg_advisory_xact_lock/)).toBeGreaterThan(1);
    expect(idx(/SET assigned_am = \$2/)).toBeGreaterThan(idx(/pg_advisory_xact_lock/));
    expect(idx(/INSERT INTO crm_lead_assignment_log/)).toBeGreaterThan(idx(/SET assigned_am/));
    expect(idx(/handoff_status = 'pending'/)).toBeGreaterThan(idx(/INSERT INTO crm_lead_assignment_log/));
    expect(calls[calls.length - 1]).toBe('COMMIT');
    expect(calls.filter((s) => s === 'BEGIN').length).toBe(1);
    expect(calls).not.toContain('ROLLBACK');
    // Nothing of the handoff / assignment goes through the shared pool outside the transaction.
    expect(db.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(r.noteLeadStep).toHaveBeenCalledTimes(1);
  });

  it('rolls the auto-assign back when the handoff update fails', async () => {
    const { repo, r, client, sql } = makeRepo({ pool: [108], failOn: /handoff_status = 'pending'/ });
    await expect(repo.handoffToSolution(121, 5)).rejects.toThrow('boom');
    const calls = sql();
    expect(calls.some((s) => /INSERT INTO crm_lead_assignment_log/.test(s))).toBe(true);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(r.applyPresalesConsultPrefill).not.toHaveBeenCalled();
    expect(r.noteLeadStep).not.toHaveBeenCalled();
  });

  it('re-checks the locked row so a concurrent submit cannot assign twice', async () => {
    const { repo, sql } = makeRepo({ pool: [108], lockedHandoff: 'pending' });
    await expect(repo.handoffToSolution(121, 5)).rejects.toThrow('Lead đã được giao Solution.');
    const calls = sql();
    expect(calls.some((s) => /pg_advisory_xact_lock|crm_lead_assignment_log|SET assigned_am/.test(s))).toBe(false);
    expect(calls).toContain('ROLLBACK');
  });
});
