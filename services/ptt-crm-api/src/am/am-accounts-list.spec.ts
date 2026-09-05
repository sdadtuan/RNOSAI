import { amScopeSql } from './am-scope.util';
import { AmAccountsService } from './am-accounts.service';

function listSql(db: { query: jest.Mock }): string {
  const call = db.query.mock.calls.find((entry) => {
    const sql = String(entry[0]);
    return /crm_am_account_ext/i.test(sql) && /select/i.test(sql) && !/insert/i.test(sql);
  });
  return call ? String(call[0]) : '';
}

function listParams(db: { query: jest.Mock }): unknown[] {
  const call = db.query.mock.calls.find((entry) => {
    const sql = String(entry[0]);
    return /crm_am_account_ext/i.test(sql) && /select/i.test(sql) && !/insert/i.test(sql);
  });
  return (call && Array.isArray(call[1]) ? call[1] : []) as unknown[];
}

describe('AmAccountsService.list', () => {
  const VIEW_STAFF_ID = 7;
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const agency = { createClient: jest.fn() };
  const db = {
    query: jest.fn(async () => ({ rows: [] as Record<string, unknown>[], rowCount: 0 })),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => VIEW_STAFF_ID),
    me: jest.fn(async () => ({ caps: [{ section: 'crm_am', action: 'view' }] })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  let service: AmAccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(VIEW_STAFF_ID);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'view' }] });
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmAccountsService(agency as never, db as never, staffAuth as never);
  });

  it('hides churned by default', async () => {
    await service.list(viewReq, {});
    const sql = listSql(db);
    expect(sql).toMatch(/am_status/i);
    expect(sql).toMatch(/churned/i);
    expect(sql).toMatch(/am_status\s*(<>|!=|NOT\s+IN)/i);
  });

  it('view cannot see other owner', async () => {
    await service.list(viewReq, { scope: 'all', owner: '99' });
    const sql = listSql(db);
    const params = listParams(db);
    const scoped = amScopeSql({ scope: 'me', staffId: VIEW_STAFF_ID, teamIds: [] });
    expect(sql).toMatch(/account_owner_staff_id/);
    expect(sql).toContain('e.account_owner_staff_id');
    expect(sql).not.toMatch(/AND TRUE(\s|$)/);
    expect(params).toEqual(expect.arrayContaining(scoped.params));
    expect(params).toContain(VIEW_STAFF_ID);
  });

  it('sorts ends_on server-side', async () => {
    await service.list(viewReq, { sort: 'ends_on' });
    const sql = listSql(db);
    expect(sql).toMatch(/ORDER BY[\s\S]*ends_on/i);
  });

  it('fills delegated_until from active outbound delegation', async () => {
    await service.list(viewReq, {});
    const sql = listSql(db);
    expect(sql).toMatch(/crm_am_delegations/);
    expect(sql).toMatch(/MAX\(\s*d\.ends_on/i);
    expect(sql).toMatch(/d\.from_staff_id = e\.account_owner_staff_id/);
  });
});
