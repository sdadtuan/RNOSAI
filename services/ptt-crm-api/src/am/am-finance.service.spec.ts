import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmFinanceService } from './am-finance.service';
import { AmController } from './am.controller';
import { AM_REQUIRED_ACTION_KEY, AM_REQUIRED_SECTION_KEY } from './guards/staff-am.guard';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const STAFF_ID = 7;
const MRR = 20_000_000;
const MEDIA = 50_000_000;
const ISSUED_AMOUNT = 5_000_000;
const ISSUED_PAID = 1_000_000;
const OVERDUE_AMOUNT = 2_000_000;
const NEXT_AMOUNT = 3_000_000;
const LAST_SYNC = '2026-09-01T10:00:00.000Z';

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

function ictToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00+07:00`) + days * 86_400_000;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function collectVnd(value: unknown): unknown[] {
  if (value == null || typeof value !== 'object') return [];
  const out: unknown[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith('_vnd')) out.push(nested);
    if (nested && typeof nested === 'object') out.push(...collectVnd(nested));
  }
  return out;
}

describe('AmFinanceService', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const db: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({ caps: [{ section: 'crm_am', action: 'view' }] })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  const today = ictToday();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  const contracts = [
    {
      billing_type: 'monthly',
      amount_vnd: MRR,
      starts_on: '2026-01-01',
      ends_on: '2026-12-31',
      status: 'active',
    },
    {
      billing_type: 'media',
      amount_vnd: MEDIA,
      starts_on: '2026-01-01',
      ends_on: null,
      status: 'active',
    },
  ];

  const invoices = [
    {
      id: 11,
      invoice_number: 'INV-011',
      status: 'issued',
      issued_on: '2026-08-01',
      due_on: tomorrow,
      amount_vnd: ISSUED_AMOUNT,
      paid_vnd: ISSUED_PAID,
      updated_at: LAST_SYNC,
    },
    {
      id: 12,
      invoice_number: 'INV-012',
      status: 'overdue',
      issued_on: '2026-07-01',
      due_on: yesterday,
      amount_vnd: OVERDUE_AMOUNT,
      paid_vnd: 0,
      updated_at: '2026-08-15T00:00:00.000Z',
    },
    {
      id: 13,
      invoice_number: 'INV-013',
      status: 'issued',
      issued_on: '2026-08-20',
      due_on: tomorrow,
      amount_vnd: NEXT_AMOUNT,
      paid_vnd: 0,
      updated_at: '2026-08-20T00:00:00.000Z',
    },
  ];

  let service: AmFinanceService;

  function mockQueries(opts: {
    inScope?: boolean;
    crmTable?: string | null;
    invoicesTable?: string | null;
    contracts?: Record<string, unknown>[];
    invoices?: Record<string, unknown>[];
  } = {}) {
    const inScope = opts.inScope !== false;
    const crmTable = opts.crmTable === undefined ? 'crm_invoices' : opts.crmTable;
    const invoicesTable = opts.invoicesTable === undefined ? null : opts.invoicesTable;
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/to_regclass/i.test(text)) {
        return { rows: [{ crm: crmTable, inv: invoicesTable }], rowCount: 1 };
      }
      if (/crm_am_account_ext/i.test(text) && /clients/i.test(text)) {
        return {
          rows: inScope ? [{ agency_client_id: CLIENT_ID }] : [],
          rowCount: inScope ? 1 : 0,
        };
      }
      if (/from crm_contracts/i.test(text)) {
        return { rows: opts.contracts ?? contracts, rowCount: (opts.contracts ?? contracts).length };
      }
      if (/from crm_invoices|from invoices\b/i.test(text)) {
        const rows = opts.invoices ?? invoices;
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(STAFF_ID);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'view' }] });
    mockQueries();
    service = new AmFinanceService(db as never, staffAuth as never);
  });

  it('hides every *_vnd amount when actor has only crm_am.view', async () => {
    const out = await service.get(viewReq, CLIENT_ID);
    expect(out.hidden).toBe(true);
    expect(collectVnd(out).every((value) => value == null)).toBe(true);
    expect(out.invoices.map((row) => row.number)).toEqual(['INV-011', 'INV-012', 'INV-013']);
    expect(out.invoices[1]?.status).toBe('overdue');
    expect(out.invoices[1]?.due_on).toBe(yesterday);
  });

  it('exports no update/patch/pay/issue method', () => {
    const proto = Object.getOwnPropertyNames(AmFinanceService.prototype);
    const staticKeys = Object.getOwnPropertyNames(AmFinanceService);
    expect([...proto, ...staticKeys].filter((key) => /update|patch|pay|issue/i.test(key))).toEqual([]);
  });

  it('returns stale snapshot with null kpis when invoice tables are missing', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am.finance', action: 'view' },
      ],
    });
    mockQueries({ crmTable: null, invoicesTable: null });
    const out = await service.get(viewReq, CLIENT_ID);
    expect(out.stale).toBe(true);
    expect(out.source).toBeNull();
    expect(out.invoices).toEqual([]);
    expect(out.kpis).toEqual({
      mrr_vnd: null,
      active_total_vnd: null,
      outstanding_vnd: null,
      overdue_vnd: null,
      next_invoice_on: null,
      next_invoice_vnd: null,
    });
    expect(db.query.mock.calls.some(([sql]) => /ensureBillingSchemaPg|CREATE TABLE/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('returns invoice and contract amounts when in-scope actor has finance view', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am.finance', action: 'view' },
      ],
    });
    mockQueries();
    const out = await service.get(viewReq, CLIENT_ID);
    expect(out.hidden).toBe(false);
    expect(out.stale).toBe(false);
    expect(out.source).toBe('crm_invoices');
    expect(out.erp_href).toBe('/crm/invoices');
    expect(out.last_sync).toBe(LAST_SYNC);
    expect(out.kpis.mrr_vnd).toBe(MRR);
    expect(out.kpis.active_total_vnd).toBe(MRR + MEDIA);
    expect(out.kpis.outstanding_vnd).toBe(ISSUED_AMOUNT - ISSUED_PAID + OVERDUE_AMOUNT + NEXT_AMOUNT);
    expect(out.kpis.overdue_vnd).toBe(OVERDUE_AMOUNT);
    expect(out.kpis.next_invoice_on).toBe(tomorrow);
    expect(out.kpis.next_invoice_vnd).toBe(ISSUED_AMOUNT);
    expect(out.invoices[1]?.amount_vnd).toBe(OVERDUE_AMOUNT);
    expect(out.invoices[1]?.aging_days).toBe(1);
  });

  it('returns 404 for unknown or out-of-scope clients', async () => {
    mockQueries({ inScope: false });
    await expect(service.get(viewReq, CLIENT_ID)).rejects.toMatchObject({ status: 404, error: 'not_found' });
  });
});

describe('AmController finance route', () => {
  it('exposes GET finance/:agencyClientId with crm_am view only', () => {
    const fn = (AmController.prototype as unknown as Record<string, object>).getFinance;
    expect(String(Reflect.getMetadata(PATH_METADATA, fn) ?? '')).toBe('finance/:agencyClientId');
    expect(Reflect.getMetadata(METHOD_METADATA, fn)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, fn)).toBe('view');
    expect(Reflect.getMetadata(AM_REQUIRED_SECTION_KEY, fn)).toBeUndefined();
  });

  it('has no mutating finance handler', () => {
    const mutating = Object.getOwnPropertyNames(AmController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const fn = (AmController.prototype as unknown as Record<string, object>)[name];
        return {
          name,
          path: String(Reflect.getMetadata(PATH_METADATA, fn) ?? ''),
          method: Reflect.getMetadata(METHOD_METADATA, fn) as RequestMethod | undefined,
        };
      })
      .filter((route) => {
        const mutatingMethod =
          route.method === RequestMethod.PATCH ||
          route.method === RequestMethod.PUT ||
          route.method === RequestMethod.POST ||
          route.method === RequestMethod.DELETE;
        return mutatingMethod && /finance/i.test(`${route.name} ${route.path}`);
      });
    expect(mutating).toEqual([]);
  });
});
