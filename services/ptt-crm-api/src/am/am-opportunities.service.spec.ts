import { AmOpportunitiesService } from './am-opportunities.service';

const STAFF_ID = 7;
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const UNKNOWN_ID = '19d722af-0000-4000-8000-000000000099';
const OPP_ID = '19d722af-0000-4000-8000-0000000000cc';

describe('AmOpportunitiesService', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
      ],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = {
    insert: jest.fn(),
  };

  let service: AmOpportunitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmOpportunitiesService(repo as never, staffAuth as never, audit as never);
  });

  function insertedOpp(overrides: Record<string, unknown> = {}) {
    return {
      id: OPP_ID,
      agency_client_id: CLIENT_ID,
      account_name: 'Green Home',
      title: 'AI Agent',
      kind: 'cross-sell',
      package: null,
      value_vnd: null,
      probability: null,
      stage: 'qualify',
      next_step: 'Demo',
      source: 'manual',
      ai_evidence_json: null,
      won_at: null,
      lost_at: null,
      created_at: '2026-09-05T00:00:00.000Z',
      ...overrides,
    };
  }

  function mockExistingClient(insertRow: Record<string, unknown> = insertedOpp()) {
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/FROM clients/i.test(text)) {
        return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_account_ext/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
      }
      if (/INSERT INTO crm_am_opportunities/i.test(text)) {
        return { rows: [insertRow], rowCount: 1 };
      }
      if (/UPDATE crm_am_opportunities/i.test(text)) {
        return { rows: [{ ...insertRow, stage: 'won' }], rowCount: 1 };
      }
      if (/FROM crm_am_opportunities/i.test(text)) {
        return { rows: [insertRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  it('POST unknown / missing clients id returns 400 client_not_found and does not insert', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM clients/i.test(String(sql))) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.create(
        viewReq,
        { agency_client_id: UNKNOWN_ID, title: 'Upsell', next_step: 'Demo' },
        STAFF_ID,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'client_not_found' });
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_am_opportunities/i.test(String(sql))),
    ).toBe(false);
  });

  it('POST stage=won does not INSERT INTO crm_contracts', async () => {
    mockExistingClient(insertedOpp({ stage: 'won', value_vnd: 1000 }));

    await service.create(
      viewReq,
      {
        agency_client_id: CLIENT_ID,
        title: 'Won deal',
        next_step: 'Kickoff',
        stage: 'won',
        value_vnd: 1000,
      },
      STAFF_ID,
    );

    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_contracts/i.test(String(sql))),
    ).toBe(false);
  });

  it('PATCH stage=won does not INSERT INTO crm_contracts', async () => {
    mockExistingClient(insertedOpp());

    await service.patch(viewReq, OPP_ID, { stage: 'won' }, STAFF_ID);

    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_contracts/i.test(String(sql))),
    ).toBe(false);
  });

  it('rejects stage not in the five with 400 invalid_stage', async () => {
    await expect(
      service.create(
        viewReq,
        { agency_client_id: CLIENT_ID, title: 'X', next_step: 'Y', stage: 'discovery' },
        STAFF_ID,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'invalid_stage' });
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_am_opportunities/i.test(String(sql))),
    ).toBe(false);
  });

  it('creates one row for an existing in-scope client', async () => {
    mockExistingClient();

    await expect(
      service.create(
        viewReq,
        { agency_client_id: CLIENT_ID, title: 'AI Agent', next_step: 'Demo' },
        STAFF_ID,
      ),
    ).resolves.toMatchObject({ id: OPP_ID, title: 'AI Agent', next_step: 'Demo' });
    expect(
      repo.query.mock.calls.filter(([sql]) => /INSERT INTO crm_am_opportunities/i.test(String(sql))),
    ).toHaveLength(1);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'opportunity.create', entity_id: OPP_ID }),
    );
  });

  it('GET KPIs are null when no values and suggestions stay empty', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/FROM crm_am_opportunities/i.test(text)) {
        return {
          rows: [insertedOpp({ value_vnd: null, probability: null, stage: 'qualify' })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const out = await service.list(viewReq, {});
    expect(out.kpis).toEqual({
      pipeline_vnd: null,
      weighted_vnd: null,
      won_month_vnd: null,
    });
    expect(out.suggestions).toEqual([]);
  });
});
