import { AmAccountsService } from './am-accounts.service';

describe('AmAccountsService', () => {
  const agency = {
    createClient: jest.fn(),
  };

  const db = {
    inserts: [] as string[],
    query: jest.fn(async (sql: string) => {
      if (/insert/i.test(sql)) db.inserts.push(sql);
      return { rows: [{ id: 'uuid' }], rowCount: 1 };
    }),
  };

  const staffAuth = {
    hasCap: jest.fn(() => true),
  };

  const actor = { staffId: 1, caps: [{ section: 'crm_agency', action: 'create' }] };

  let service: AmAccountsService;

  beforeEach(() => {
    db.inserts.length = 0;
    jest.clearAllMocks();
    staffAuth.hasCap.mockReturnValue(true);
    agency.createClient.mockResolvedValue({
      id: '19d722af-0000-4000-8000-000000000001',
      code: 'AP01',
      name: 'An Phu',
    });
    service = new AmAccountsService(agency as never, db as never, staffAuth as never);
  });

  it('create does not INSERT into a second customer table', async () => {
    await service.createAccount({ mode: 'create', code: 'AP01', name: 'An Phu' }, actor);
    expect(agency.createClient).toHaveBeenCalled();
    expect(db.inserts.some((s) => /insert into clients/i.test(s) && s.includes('am_'))).toBe(false);
  });

  it('attach does not call createClient', async () => {
    await service.createAccount({ mode: 'attach', agency_client_id: 'uuid' }, actor);
    expect(agency.createClient).not.toHaveBeenCalled();
  });

  it('attach does not overwrite an existing owner (first-writer-wins)', async () => {
    await service.createAccount({ mode: 'attach', agency_client_id: 'uuid', owner_staff_id: 99 }, actor);
    const upsert = db.query.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => /crm_am_account_ext/i.test(sql));
    expect(upsert).toMatch(
      /COALESCE\s*\(\s*crm_am_account_ext\.account_owner_staff_id\s*,\s*EXCLUDED\.account_owner_staff_id\s*\)/i,
    );
  });
});
