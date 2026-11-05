import { AmAccountsService } from './am-accounts.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const OTHER_CLIENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

describe('AmAccountsService.transfer', () => {
  const agency = { createClient: jest.fn() };
  const db: {
    sqls: string[];
    query: jest.MockedFunction<QueryFn>;
    withTransaction: jest.MockedFunction<(fn: (query: QueryFn) => Promise<unknown>) => Promise<unknown>>;
  } = {
    sqls: [],
    query: jest.fn(async (sql: string) => {
      db.sqls.push(sql);
      return mockQuery(sql);
    }),
    withTransaction: jest.fn(async (fn) => fn(db.query)),
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
  const manageActor = {
    staffId: 4,
    caps: [{ section: 'crm_am', action: 'manage' }],
    via: 'jwt' as const,
  };

  let service: AmAccountsService;
  let scopedRows: Array<{
    agency_client_id: string;
    account_owner_staff_id: number;
    backup_staff_id: number | null;
  }>;
  let crmStaffIds: Set<number>;

  function mockQuery(sql: string): { rows: Record<string, unknown>[]; rowCount: number } {
    if (/SELECT id FROM crm_staff WHERE id/i.test(sql)) {
      const ok = [...crmStaffIds].map((id) => ({ id }));
      return { rows: ok.length ? [ok[0]] : [], rowCount: ok.length ? 1 : 0 };
    }
    if (/FROM staff_users u/i.test(sql) && /JOIN crm_staff/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (/staff_user_teams|staff_teams/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (/select/i.test(sql) && /crm_am_account_ext/i.test(sql)) {
      return { rows: scopedRows, rowCount: scopedRows.length };
    }
    if (/update\s+crm_am_account_ext/i.test(sql)) {
      return { rows: [], rowCount: scopedRows.length };
    }
    return { rows: [], rowCount: 1 };
  }

  beforeEach(() => {
    db.sqls.length = 0;
    audit.calls.length = 0;
    scopedRows = [
      { agency_client_id: CLIENT_ID, account_owner_staff_id: 1, backup_staff_id: null },
    ];
    crmStaffIds = new Set([9]);
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      return mockQuery(sql);
    });
    db.withTransaction.mockImplementation(async (fn) => fn(db.query));
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

  it('assign+me cannot transfer another owner UUID', async () => {
    scopedRows = [];
    await expect(
      service.transfer(
        { agency_client_ids: [OTHER_CLIENT_ID], to_staff_id: 9, reason: 'handover' },
        assignActor,
      ),
    ).rejects.toMatchObject({ status: 403, error: 'out_of_scope' });
    expect(db.sqls.some((sql) => /update\s+clients/i.test(sql))).toBe(false);
    expect(db.sqls.some((sql) => /update\s+crm_am_account_ext/i.test(sql))).toBe(false);
  });

  it('rejects to_staff_id that is not crm_staff', async () => {
    crmStaffIds = new Set();
    await expect(
      service.transfer(
        { agency_client_ids: [CLIENT_ID], to_staff_id: 99, reason: 'handover' },
        assignActor,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'to_staff_id_invalid' });
    expect(db.sqls.some((sql) => /update\s+clients/i.test(sql))).toBe(false);
  });

  it('resolves staff_users.id to crm_staff.id via email', async () => {
    crmStaffIds = new Set();
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      if (/SELECT id FROM crm_staff WHERE id/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM staff_users u/i.test(sql) && /JOIN crm_staff/i.test(sql)) {
        return { rows: [{ id: 42 }], rowCount: 1 };
      }
      return mockQuery(sql);
    });
    const out = await service.transfer(
      { agency_client_ids: [CLIENT_ID], to_staff_id: 99, reason: 'handover' },
      assignActor,
    );
    expect(out.to_staff_id).toBe(42);
    const clientUpdate = db.sqls.find((sql) => /update\s+clients/i.test(sql));
    expect(clientUpdate).toBeTruthy();
    const clientParams = db.query.mock.calls.find((call) => /update\s+clients/i.test(String(call[0])));
    expect(clientParams?.[1]?.[0]).toBe('42');
  });

  it('manage uses all-scope and reports transferred from rowCount', async () => {
    const out = await service.transfer(
      { agency_client_ids: [CLIENT_ID], to_staff_id: 9, reason: 'handover' },
      manageActor,
    );
    expect(out.transferred).toBe(1);
    const scopedSelect = db.sqls.find((sql) => /select/i.test(sql) && /crm_am_account_ext/i.test(sql)) ?? '';
    expect(scopedSelect).toMatch(/TRUE/);
    expect(db.withTransaction).toHaveBeenCalled();
  });
});
