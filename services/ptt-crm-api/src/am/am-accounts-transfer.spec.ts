import { AmAccountsService } from './am-accounts.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';

describe('AmAccountsService.transfer', () => {
  const agency = { createClient: jest.fn() };
  const db = {
    sqls: [] as string[],
    query: jest.fn(async (sql: string) => {
      db.sqls.push(sql);
      if (/select/i.test(sql) && /account_owner_staff_id/i.test(sql)) {
        return {
          rows: [{ agency_client_id: CLIENT_ID, account_owner_staff_id: 3, backup_staff_id: null }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
  const staffAuth = {
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = {
    calls: [] as Array<{ action: string; entity_type: string; payload_json?: Record<string, unknown> }>,
    insert: jest.fn(async (row: { action: string; entity_type: string; payload_json?: Record<string, unknown> }) => {
      audit.calls.push(row);
    }),
  };

  const assignActor = {
    staffId: 1,
    caps: [{ section: 'crm_am', action: 'assign' }],
    via: 'jwt' as const,
  };
  const viewActor = {
    staffId: 2,
    caps: [{ section: 'crm_am', action: 'view' }],
    via: 'jwt' as const,
  };

  let service: AmAccountsService;

  beforeEach(() => {
    db.sqls.length = 0;
    audit.calls.length = 0;
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      if (/select/i.test(sql) && /account_owner_staff_id/i.test(sql)) {
        return {
          rows: [{ agency_client_id: CLIENT_ID, account_owner_staff_id: 3, backup_staff_id: null }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    service = new AmAccountsService(
      agency as never,
      db as never,
      staffAuth as never,
      undefined,
      audit as never,
    );
  });

  it('rejects transfer without reason', async () => {
    await expect(
      service.transfer(
        { agency_client_ids: [CLIENT_ID], to_staff_id: 9, reason: '' },
        assignActor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects view user with 403', async () => {
    await expect(
      service.transfer(
        { agency_client_ids: [CLIENT_ID], to_staff_id: 9, reason: 'handover' },
        viewActor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('moves open tasks only when move_open_tasks is true', async () => {
    await service.transfer(
      {
        agency_client_ids: [CLIENT_ID],
        to_staff_id: 9,
        reason: 'handover',
        move_open_tasks: false,
      },
      assignActor,
    );
    expect(db.sqls.some((sql) => /update\s+crm_am_tasks/i.test(sql))).toBe(false);

    db.sqls.length = 0;
    await service.transfer(
      {
        agency_client_ids: [CLIENT_ID],
        to_staff_id: 9,
        reason: 'handover',
        move_open_tasks: true,
      },
      assignActor,
    );
    expect(db.sqls.some((sql) => /update\s+crm_am_tasks/i.test(sql))).toBe(true);
  });

  it('writes account.transfer audit and a single owner', async () => {
    await service.transfer(
      {
        agency_client_ids: [CLIENT_ID],
        to_staff_id: 9,
        reason: 'handover',
        keep_secondary: true,
      },
      assignActor,
    );
    expect(audit.calls[0]?.action).toBe('account.transfer');
    const ownerUpdate = db.sqls.find((sql) => /update\s+crm_am_account_ext/i.test(sql)) ?? '';
    expect(ownerUpdate).toMatch(/account_owner_staff_id/);
    expect(ownerUpdate).toMatch(/backup_staff_id/);
  });
});
