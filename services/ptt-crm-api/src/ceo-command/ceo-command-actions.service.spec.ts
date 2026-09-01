import { CeoCommandActionsService } from './ceo-command-actions.service';
import type { CeoActor } from './ceo-command.types';

describe('CeoCommandActionsService — §20 actions', () => {
  const actor: CeoActor = { staffId: 1, staffLabel: 'ceo@test.vn', caps: [] };

  const notifications = { create: jest.fn().mockResolvedValue({ id: 'n-1' }) };
  const contracts = {
    getContractForLead: jest.fn().mockResolvedValue({
      contract: { id: 9, status: 'draft' },
      approval: { id: 3, contract_id: 9, status: 'pending' },
    }),
    approve: jest.fn(),
    reject: jest.fn(),
    submitForApproval: jest.fn(),
  };
  const leadsWrite = { mergeLeadMeta: jest.fn().mockResolvedValue(undefined) };
  const crmStaffPg = {
    getStaffById: jest.fn().mockResolvedValue({ id: 5, email: 'gdkd@test.vn', name: 'GDKD' }),
  };

  const dbQuery = jest.fn();
  const config = { databaseUrl: 'postgres://test' };

  function makeService() {
    const svc = new CeoCommandActionsService(
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      crmStaffPg as never,
      notifications as never,
      {} as never,
      contracts as never,
      leadsWrite as never,
      { wrap: jest.fn(async (_ctx, fn) => fn()) } as never,
    );
    Object.defineProperty(svc, 'db', {
      get: () => ({ query: dbQuery }),
    });
    return svc;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('staff_users')) {
        return { rows: [{ id: 'uuid-gdkd' }] };
      }
      if (sql.includes('crm_positions')) {
        return { rows: [{ id: 5 }] };
      }
      return { rows: [] };
    });
  });

  it('remind_contract_approval notifies GDKD and does not mutate contract', async () => {
    const svc = makeService();
    const out = await (svc as unknown as { executeAction: Function }).executeAction(
      'remind_contract_approval',
      { lead_id: 42 },
      actor,
    );

    expect(out).toMatchObject({
      notification_id: 'n-1',
      lead_id: 42,
      link_href: '/crm/hub?lead_id=42',
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ceo_remind',
        link_href: '/crm/hub?lead_id=42',
      }),
    );
    expect(contracts.getContractForLead).toHaveBeenCalledWith(42);
    expect(contracts.approve).not.toHaveBeenCalled();
    expect(contracts.reject).not.toHaveBeenCalled();
    expect(contracts.submitForApproval).not.toHaveBeenCalled();
    expect(leadsWrite.mergeLeadMeta).not.toHaveBeenCalled();
  });

  it('prioritize_solution_queue patches meta_json and notifies MKT-01', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('staff_users')) {
        return { rows: [{ id: 'uuid-mkt' }] };
      }
      if (sql.includes('crm_positions')) {
        return { rows: [{ id: 8 }] };
      }
      return { rows: [] };
    });
    crmStaffPg.getStaffById.mockResolvedValueOnce({ id: 8, email: 'mkt@test.vn', name: 'MKT' });

    const svc = makeService();
    const out = await (svc as unknown as { executeAction: Function }).executeAction(
      'prioritize_solution_queue',
      { lead_id: 30, note: 'VIP case' },
      actor,
    );

    expect(leadsWrite.mergeLeadMeta).toHaveBeenCalledWith(30, { priority_consult: 'ceo' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ceo_remind',
        body: expect.stringContaining('VIP case'),
        link_href: '/crm/hub?lead_id=30',
      }),
    );
    expect(out).toMatchObject({
      lead_id: 30,
      priority_consult: 'ceo',
    });
    expect(contracts.approve).not.toHaveBeenCalled();
  });
});
