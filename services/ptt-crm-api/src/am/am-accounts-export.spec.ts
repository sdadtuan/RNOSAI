import { AmAccountsService } from './am-accounts.service';

describe('AmAccountsService export + bulkTag', () => {
  const VIEW_STAFF_ID = 7;
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;
  const editReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000008' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const agency = { createClient: jest.fn() };
  const db = {
    query: jest.fn() as jest.Mock,
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

  it('rejects export at 10000 rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 10000 }], rowCount: 1 });
    await expect(service.exportCsv(viewReq, {})).rejects.toMatchObject({
      response: { error: 'export_too_large', max: 10000 },
    });
  });

  it('adds tags without dropping existing ones', async () => {
    const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
    const updates: Array<{ sql: string; params: unknown[] }> = [];
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/^\s*update/i.test(text)) {
        updates.push({ sql: text, params: params ?? [] });
        return { rows: [], rowCount: 1 };
      }
      if (/select/i.test(text) && /tags/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID, tags: ['a'] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const out = await service.bulkTag(editReq, {
      agency_client_ids: [CLIENT_ID],
      tags: ['b'],
      mode: 'add',
    });
    expect(out.updated).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toMatch(/unnest/i);
    expect(updates[0].sql).toMatch(/\|\|/);
    expect(updates[0].sql).toMatch(/distinct/i);
    const written = JSON.stringify(updates[0].params);
    expect(written).toMatch(/b/);
    expect(written).not.toMatch(/"a"/);
  });

  it('assign lead can tag team-visible accounts and 403s outside that scope', async () => {
    const TEAM_CLIENT = '19d722af-0000-4000-8000-000000000001';
    const OUTSIDE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_am', action: 'assign' },
      ],
    });
    db.query.mockImplementation(async function (sql: string, params?: unknown[]) {
      const text = String(sql);
      if (/staff_user_teams|staff_teams/i.test(text)) {
        return { rows: [{ id: 3 }], rowCount: 1 };
      }
      if (/^\s*update/i.test(text)) {
        return { rows: [], rowCount: 1 };
      }
      if (/select/i.test(text) && /tags/i.test(text)) {
        expect(text).toMatch(/team_id\s*=\s*ANY/i);
        const ids = Array.isArray(params?.[1]) ? (params[1] as string[]) : [];
        const rows = ids.includes(TEAM_CLIENT)
          ? [{ agency_client_id: TEAM_CLIENT, tags: ['a'] }]
          : [];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const out = await service.bulkTag(editReq, {
      agency_client_ids: [TEAM_CLIENT],
      tags: ['vip'],
      mode: 'add',
    });
    expect(out.updated).toBe(1);
    await expect(
      service.bulkTag(editReq, {
        agency_client_ids: [OUTSIDE],
        tags: ['vip'],
        mode: 'add',
      }),
    ).rejects.toMatchObject({ status: 403, error: 'out_of_scope' });
  });

  it('blanks mrr_vnd without crm_am.finance and hides churned by default', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            agency_client_id: '19d722af-0000-4000-8000-000000000001',
            code: 'AP01',
            name: 'An Phu',
            owner_staff_id: 7,
            team_id: 3,
            am_status: 'active',
            health_band: 'healthy',
            mrr_vnd: 1_500_000,
            ends_on: '2026-10-01',
          },
        ],
        rowCount: 1,
      });
    const out = await service.exportCsv(viewReq, {});
    expect(out.rows).toBe(1);
    expect(out.csv).toMatch(
      /^agency_client_id,code,name,owner_staff_id,team_id,am_status,health_band,mrr_vnd,ends_on\n/,
    );
    expect(out.csv).not.toMatch(/1500000/);
    const countSql = String(db.query.mock.calls[0]?.[0] ?? '');
    expect(countSql).toMatch(/am_status\s*(<>|!=|NOT\s+IN)/i);
    expect(countSql).toMatch(/churned/i);
  });

  it('blanks mrr_vnd for manage without crm_am.finance view', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_am', action: 'manage' }],
    });
    db.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            agency_client_id: '19d722af-0000-4000-8000-000000000001',
            code: 'AP01',
            name: 'An Phu',
            owner_staff_id: 7,
            team_id: 3,
            am_status: 'active',
            health_band: 'healthy',
            mrr_vnd: 1_500_000,
            ends_on: '2026-10-01',
          },
        ],
        rowCount: 1,
      });
    const out = await service.exportCsv(viewReq, {});
    expect(out.rows).toBe(1);
    expect(out.csv).not.toMatch(/1500000/);
    const dataLine = out.csv.split('\n')[1] ?? '';
    expect(dataLine.split(',')[7]).toBe('');
  });
});
