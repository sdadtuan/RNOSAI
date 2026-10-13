import { LeadAutoAssignService } from './lead-auto-assign.service';

describe('LeadAutoAssignService intake', () => {
  it('does not give a paused AE the next round-robin lead', async () => {
    const service = new LeadAutoAssignService({
      fetchSnapshot: async () => ({
        lead_config: {},
        staff_rows: [
          { id: 1, name: 'Một', active: true },
          { id: 2, name: 'Hai', active: true },
        ],
        assignment_state: [],
        staff_assign_scope: [],
      }),
      persistAssignmentState: async () => undefined,
      listPausedIntakeStaffIds: async () => new Set([1]),
    } as never);
    const result = await service.assignOwner({});
    expect(result?.owner_id).toBe(2);
  });
});
