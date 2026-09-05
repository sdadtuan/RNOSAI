import { AmRenewalsService } from './am-renewals.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const CASE_ID = '19d722af-0000-4000-8000-0000000000aa';
const STAFF_ID = 7;
const MEDIA_AMOUNT = 1_000_000_000;
const RETAINER_MRR = 10_000_000;

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

describe('AmRenewalsService', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const db: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_am', action: 'view_all' },
      ],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = {
    calls: [] as Array<{ action: string }>,
    insert: jest.fn(async (row: { action: string }) => {
      audit.calls.push(row);
    }),
  };

  const contractRow = {
    id: 84,
    contract_id: 84,
    reference_code: 'HD-TEST',
    title: 'SEO Retainer',
    status: 'active',
    billing_type: 'monthly',
    service_slug: 'seo',
    starts_on: '2026-01-01',
    ends_on: '2026-12-31',
    amount_vnd: RETAINER_MRR,
    agency_client_id: CLIENT_ID,
    client_name: 'An Phú',
    client_code: 'AP01',
  };

  const openCaseRow = {
    id: CASE_ID,
    agency_client_id: CLIENT_ID,
    contract_id: 84,
    status: 'evaluating',
    forecast: 'likely',
    forecast_pct: 65,
    next_action: 'Họp Q3',
    lost_reason: null,
    lost_on: null,
    lessons: null,
    new_contract_id: null,
    name: 'An Phú',
    owner_label: 'Minh',
    ends_on: '2026-12-31',
    billing_type: 'monthly',
    amount_vnd: RETAINER_MRR,
    starts_on: '2026-01-01',
    score: 72,
    band: 'watch',
    reference_code: 'HD-TEST',
  };

  let service: AmRenewalsService;

  beforeEach(() => {
    audit.calls.length = 0;
    jest.clearAllMocks();
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_am', action: 'view_all' },
      ],
    });
    db.query.mockImplementation(async (_sql: string) => ({ rows: [], rowCount: 0 }));
    service = new AmRenewalsService(db as never, staffAuth as never, audit as never);
  });

  it('second POST same contract returns 409 open_case_exists', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return { rows: [contractRow], rowCount: 1 };
      }
      if (/insert into crm_am_renewal_cases/i.test(text)) {
        const err = Object.assign(new Error('duplicate key'), { code: '23505' });
        throw err;
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.start(viewReq, { contract_id: 84 }, STAFF_ID)).rejects.toMatchObject({
      status: 409,
      error: 'open_case_exists',
    });
    expect(audit.calls).toEqual([]);
  });

  it('PATCH lost without reason is 400 lost_fields_required and does not UPDATE', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [openCaseRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.patch(viewReq, CASE_ID, { status: 'lost' }, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'lost_fields_required',
    });
    expect(db.query.mock.calls.some(([sql]) => /update crm_am_renewal_cases/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('PATCH renewed without new_contract_id is 400 new_contract_required', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [openCaseRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.patch(viewReq, CASE_ID, { status: 'renewed' }, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'new_contract_required',
    });
    expect(db.query.mock.calls.some(([sql]) => /update crm_am_renewal_cases/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('pipeline header excludes media-only contract MRR from renewable and weighted', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'view_all' },
        { section: 'crm_am.finance', action: 'view' },
      ],
    });
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) || /crm_am_renewal_cases/i.test(text)) {
        return {
          rows: [
            {
              ...openCaseRow,
              id: CASE_ID,
              billing_type: 'media',
              amount_vnd: MEDIA_AMOUNT,
              forecast_pct: 80,
              forecast: 'likely',
              band: 'healthy',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const out = await service.list(viewReq, { window: '90' });
    expect(out.hide_amounts).toBe(false);
    expect(out.header.renewable_vnd).toBe(0);
    expect(out.header.weighted_vnd).toBe(0);
    expect(out.columns.flatMap((col) => col.items).some((card) => card.mrr_vnd == null)).toBe(true);
  });
});
