import { ForbiddenException } from '@nestjs/common';
import { AeTeamService } from './ae-team.service';

function actor() {
  return { sub: 'user-1', email: 'am@ptt.vn', display_name: 'AM', position_id: 1, token_type: 'access' as const, iat: 0, exp: 1 };
}

describe('AeTeamService reassign', () => {
  function build(opts?: { teams?: number[]; viewAll?: boolean }) {
    const logs: Array<Record<string, unknown>> = [];
    const owners: Array<{ id: number; to: number }> = [];
    const hops: Array<Record<string, unknown>> = [];
    const leads = new Map([
      [11, { id: 11, owner_id: 10, full_name: 'A', b2b_project_id: 'proj-1', lead_flow_kind: 'b2b_prospect' }],
      [12, { id: 12, owner_id: 10, full_name: 'B', b2b_project_id: null, lead_flow_kind: 'b2b_prospect' }],
      [13, { id: 13, owner_id: 11, full_name: 'C', b2b_project_id: null, lead_flow_kind: 'b2b_prospect' }],
    ]);
    const repo = {
      ensure: async () => undefined,
      leadTeamIds: async () => opts?.teams ?? [4],
      listMembers: async () => [
        { staff_id: 10, name: 'AE A', accepting: true, quota_vnd: null },
        { staff_id: 11, name: 'AE B', accepting: true, quota_vnd: null },
        { staff_id: 20, name: 'AE C', accepting: true, quota_vnd: null },
      ],
      getLeadForMove: async (id: number) => leads.get(id) ?? null,
      updateOwner: async (id: number, to: number) => {
        owners.push({ id, to });
      },
      insertAssignmentLog: async (row: Record<string, unknown>) => {
        logs.push(row);
      },
    };
    const manual = {
      requiresSplitChoice: (lead: { b2b_project_id?: string | null }) => Boolean(lead.b2b_project_id),
      applyManualOwnerChange: async (input: Record<string, unknown>) => {
        hops.push(input);
      },
    };
    const staff = {
      me: async () => ({ caps: opts?.viewAll ? [{ section: 'crm_ae_team', action: 'view_all' }] : [] }),
      resolveCrmStaffUserId: async () => 99,
    };
    const service = new AeTeamService(repo as never, { getPublishedPayload: async () => ({}) } as never, staff as never, manual as never, { create: async () => ({}) } as never);
    return { service, logs, owners, hops };
  }

  it('refuses an AE who is not a team lead', async () => {
    const { service } = build({ teams: [] });
    await expect(service.reassign(actor(), { lead_ids: [11], to_staff_id: 20, reason: 'test', split: 'no_split' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves three leads and logs from, to, and reason', async () => {
    const { service, logs, owners, hops } = build();
    const result = await service.reassign(actor(), {
      lead_ids: [11, 12, 13],
      to_staff_id: 20,
      reason: 'Nghỉ phép',
      split: 'keep_first_touch',
    });
    expect(result.moved).toBe(3);
    expect(hops).toHaveLength(1);
    expect(hops[0]).toMatchObject({ leadId: 11, fromOwnerId: 10, toOwnerId: 20, reason: 'Nghỉ phép' });
    expect(owners).toEqual([
      { id: 12, to: 20 },
      { id: 13, to: 20 },
    ]);
    expect(logs.map((row) => ({
      lead_id: row.lead_id,
      from_owner_id: row.from_owner_id,
      to_owner_id: row.to_owner_id,
      reason: row.reason,
    }))).toEqual([
      { lead_id: 11, from_owner_id: 10, to_owner_id: 20, reason: 'Nghỉ phép' },
      { lead_id: 12, from_owner_id: 10, to_owner_id: 20, reason: 'Nghỉ phép' },
      { lead_id: 13, from_owner_id: 11, to_owner_id: 20, reason: 'Nghỉ phép' },
    ]);
  });
});
