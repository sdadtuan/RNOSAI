import { amScopeSql } from './am-scope.util';
import { AmSearchService } from './am-search.service';

function unionArms(sql: string): string[] {
  const match = sql.match(/FROM\s*\(([\s\S]*?)\)\s*hits/i);
  if (!match) return [sql];
  return match[1]
    .split(/UNION ALL/i)
    .map((arm) => arm.trim())
    .filter(Boolean);
}

describe('AmSearchService', () => {
  const VIEW_STAFF_ID = 7;
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
  } as never;

  const db = {
    query: jest.fn(async () => ({ rows: [] as Record<string, unknown>[] })),
  };

  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => VIEW_STAFF_ID),
    me: jest.fn(async () => ({ caps: [{ section: 'crm_am', action: 'view' }] })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  let service: AmSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(VIEW_STAFF_ID);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'view' }] });
    db.query.mockResolvedValue({ rows: [] });
    service = new AmSearchService(db as never, staffAuth as never);
  });

  it('returns empty items for 1-char query', async () => {
    const out = await service.search(viewReq, { q: 'a' });
    expect(out).toEqual({ items: [] });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('view user cannot see other owner', async () => {
    await service.search(viewReq, { q: 'an', scope: 'all' });
    expect(db.query).toHaveBeenCalled();
    const scoped = amScopeSql({ scope: 'me', staffId: VIEW_STAFF_ID, teamIds: [] });
    for (const call of db.query.mock.calls as unknown as Array<[unknown, unknown?]>) {
      const text = String(call[0]);
      const params = (Array.isArray(call[1]) ? call[1] : []) as unknown[];
      const arms = unionArms(text);
      expect(arms.length).toBeGreaterThanOrEqual(2);
      for (const arm of arms) {
        expect(arm).toMatch(/account_owner_staff_id/);
        expect(arm).toContain('e.account_owner_staff_id');
        expect(arm).not.toMatch(/AND TRUE(\s|$)/);
      }
      expect(params).toEqual(expect.arrayContaining(scoped.params));
    }
  });

  it('ranks exact client code first', async () => {
    db.query.mockResolvedValue({
      rows: [
        { group: 'account', id: 'name-id', title: 'Apollo Name Match', code: 'ZZ99' },
        { group: 'account', id: 'code-id', title: 'Different Name', code: 'AP01' },
      ],
    });
    const out = await service.search(viewReq, { q: 'AP01' });
    expect(out.items[0]?.id).toBe('code-id');
    expect(out.items[0]?.group).toBe('account');
  });
});
