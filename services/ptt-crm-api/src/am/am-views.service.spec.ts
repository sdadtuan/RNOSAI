import { AmViewsService } from './am-views.service';

describe('AmViewsService', () => {
  const db = {
    query: jest.fn(async (): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> => ({
      rows: [],
      rowCount: 0,
    })),
  };
  const staffAuth = {
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  const viewActor = {
    staffId: 4,
    caps: [{ section: 'crm_am', action: 'view' }],
  };
  const leadActor = {
    staffId: 5,
    caps: [
      { section: 'crm_am', action: 'assign' },
      { section: 'crm_am', action: 'view_all' },
    ],
  };

  let service: AmViewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmViewsService(db as never, staffAuth as never);
  });

  it('rejects shared view from view-only user', async () => {
    await expect(
      service.create({ name: 'Team', shared: true, query_json: { owner: 'me' } }, viewActor),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects an 11th personal view', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ count: 10 }],
      rowCount: 1,
    });
    await expect(
      service.create({ name: 'Extra', query_json: {} }, viewActor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('lets a team lead save a shared view', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '19d722af-0000-4000-8000-0000000000aa',
            name: 'Team',
            shared: true,
            page: 'accounts',
            query_json: { owner: 'me' },
            owner_staff_id: 5,
            created_at: '2026-09-05T00:00:00.000Z',
          },
        ],
        rowCount: 1,
      });
    const out = await service.create(
      { name: 'Team', shared: true, query_json: { owner: 'me' } },
      leadActor,
    );
    expect(out.shared).toBe(true);
    expect(out.name).toBe('Team');
  });
});
