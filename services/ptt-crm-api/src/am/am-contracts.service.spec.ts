import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmContractsService } from './am-contracts.service';
import { AmController } from './am.controller';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const STAFF_ID = 7;
const AMOUNT = 1_020_000_000;

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

function controllerRoutes() {
  return Object.getOwnPropertyNames(AmController.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const fn = (AmController.prototype as unknown as Record<string, object>)[name];
      return {
        name,
        path: String(Reflect.getMetadata(PATH_METADATA, fn) ?? ''),
        method: Reflect.getMetadata(METHOD_METADATA, fn) as RequestMethod | undefined,
      };
    });
}

describe('AmContractsService hide_amounts', () => {
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

  const contractRow = {
    id: 84,
    reference_code: 'HD-TEST',
    title: 'SEO Retainer',
    status: 'active',
    billing_type: 'monthly',
    service_slug: 'seo',
    starts_on: '2026-01-01',
    ends_on: '2026-12-31',
    amount_vnd: AMOUNT,
    agency_client_id: CLIENT_ID,
    client_name: 'An Phú',
    client_code: 'AP01',
    notes: 'read-only',
    renewal_reminder_days: 30,
    signed_on: '2025-12-15',
  };

  let service: AmContractsService;

  beforeEach(() => {
    jest.clearAllMocks();
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(STAFF_ID);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'view' }] });
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text)) {
        return { rows: [contractRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    service = new AmContractsService(db as never, staffAuth as never);
  });

  it('hides amount_vnd and mrr_vnd without crm_am.finance view or manage', async () => {
    const out = await service.get(viewReq, '84');
    expect(out.hide_amounts).toBe(true);
    expect(out.amount_vnd).toBeNull();
    expect(out.mrr_vnd).toBeNull();
  });

  it('maps amounts with finance view and keeps media mrr_vnd null', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am.finance', action: 'view' },
      ],
    });
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text)) {
        return { rows: [{ ...contractRow, billing_type: 'media' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const out = await service.get(viewReq, '84');
    expect(out.hide_amounts).toBe(false);
    expect(out.amount_vnd).toBe(AMOUNT);
    expect(out.mrr_vnd).toBeNull();
  });
});

describe('AmController contracts mutations', () => {
  it('has no Patch/Put/Delete handler whose path includes contracts', () => {
    const mutating = controllerRoutes().filter((route) => {
      const method = route.method;
      const isMutating =
        method === RequestMethod.PATCH ||
        method === RequestMethod.PUT ||
        method === RequestMethod.DELETE;
      return isMutating && /contracts/i.test(`${route.name} ${route.path}`);
    });
    expect(mutating).toEqual([]);
  });
});
