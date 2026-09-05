import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmAccountsService, mapAccountProjectContract } from './am-accounts.service';
import { AmController } from './am.controller';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const OTHER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const VIEW_STAFF_ID = 7;

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

describe('mapAccountProjectContract', () => {
  it('maps a contract row to the 360 projects href', () => {
    expect(
      mapAccountProjectContract({
        id: 84,
        title: 'SEO 2026',
        service_slug: 'seo',
        status: 'active',
        starts_on: '2026-01-01',
        ends_on: '2026-12-31',
      }),
    ).toEqual({
      id: 84,
      title: 'SEO 2026',
      service_slug: 'seo',
      status: 'active',
      starts_on: '2026-01-01',
      ends_on: '2026-12-31',
      href: '/crm/account-management/contracts/84',
    });
  });
});

describe('AmAccountsService.projects', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const agency = { createClient: jest.fn(), updateClient: jest.fn() };
  const db = {
    query: jest.fn<ReturnType<QueryFn>, Parameters<QueryFn>>(),
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

  function mockProjectsQueries(opts?: {
    inScope?: boolean;
    deliveryRows?: Record<string, unknown>[];
    deliveryError?: { code: string; message: string };
  }) {
    const inScope = opts?.inScope !== false;
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/insert/i.test(text)) {
        throw new Error('projects must not INSERT');
      }
      if (/from crm_am_account_ext e/i.test(text) && /select/i.test(text) && /clients c/i.test(text)) {
        if (!inScope) return { rows: [], rowCount: 0 };
        return {
          rows: [
            {
              agency_client_id: CLIENT_ID,
              code: 'AP01',
              name: 'An Phu',
              industry: 'agency',
              notes: null,
              am_status: 'active',
              tier: 'A',
              team_id: 1,
              team_label: 'Enterprise',
              owner_staff_id: VIEW_STAFF_ID,
              owner_label: 'Minh',
              parent_agency_client_id: null,
              parent_name: null,
              band: 'watch',
              score: 72,
              mrr_vnd: 85_000_000,
              delivery_label: null,
              media_label: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_contracts/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              title: 'SEO 2026',
              service_slug: 'seo',
              status: 'active',
              starts_on: '2026-01-01',
              ends_on: '2026-12-31',
            },
          ],
          rowCount: 1,
        };
      }
      if (/crm_delivery_projects/i.test(text)) {
        if (opts?.deliveryError) {
          const err = new Error(opts.deliveryError.message) as Error & { code: string };
          err.code = opts.deliveryError.code;
          throw err;
        }
        return { rows: opts?.deliveryRows ?? [], rowCount: opts?.deliveryRows?.length ?? 0 };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  it('lists contracts for the account and returns empty delivery when join misses', async () => {
    mockProjectsQueries();
    const out = await service.projects(viewReq, CLIENT_ID);
    expect(out.contracts).toHaveLength(1);
    expect(out.contracts[0].href).toBe('/crm/account-management/contracts/84');
    expect(out.delivery).toEqual([]);
    const contractSql = db.query.mock.calls
      .map((call) => String(call[0]))
      .find(
        (sql) =>
          /from crm_contracts/i.test(sql) &&
          /trim\(coalesce\(ct\.agency_client_id,\s*''\)\)\s*=\s*\$1/i.test(sql) &&
          !/crm_am_account_ext/i.test(sql),
      );
    expect(contractSql).toMatch(/from crm_contracts/i);
    expect(contractSql).toMatch(/TRIM\(COALESCE\(ct\.agency_client_id,\s*''\)\)\s*=\s*\$1/i);
    expect(db.query.mock.calls.some((call) => /insert/i.test(String(call[0])))).toBe(false);
  });

  it('returns 404 not 200 when the account is out of scope', async () => {
    mockProjectsQueries({ inScope: false });
    await expect(service.projects(viewReq, OTHER_ID)).rejects.toMatchObject({ status: 404 });
    expect(db.query.mock.calls.some((call) => /insert/i.test(String(call[0])))).toBe(false);
  });

  it('returns delivery: [] when crm_delivery_projects is missing (42P01)', async () => {
    mockProjectsQueries({
      deliveryError: { code: '42P01', message: 'relation "crm_delivery_projects" does not exist' },
    });
    const out = await service.projects(viewReq, CLIENT_ID);
    expect(out.contracts).toHaveLength(1);
    expect(out.delivery).toEqual([]);
    expect(db.query.mock.calls.some((call) => /insert/i.test(String(call[0])))).toBe(false);
  });

  it('returns delivery: [] when a delivery join column is missing', async () => {
    mockProjectsQueries({
      deliveryError: { code: '42703', message: 'column b.client_id does not exist' },
    });
    const out = await service.projects(viewReq, CLIENT_ID);
    expect(out.delivery).toEqual([]);
  });

  it('deep-links delivery only when the row exists', async () => {
    mockProjectsQueries({
      deliveryRows: [{ id: '6f1c0b2a-0000-4000-8000-000000000099', name: 'SEO delivery' }],
    });
    const out = await service.projects(viewReq, CLIENT_ID);
    expect(out.delivery).toEqual([
      {
        id: '6f1c0b2a-0000-4000-8000-000000000099',
        name: 'SEO delivery',
        href: '/crm/delivery-projects/6f1c0b2a-0000-4000-8000-000000000099',
      },
    ]);
  });
});

describe('AmController projects', () => {
  it('exposes GET /accounts/:agencyClientId/projects', () => {
    const route = controllerRoutes().find(
      (item) =>
        item.method === RequestMethod.GET && item.path === 'accounts/:agencyClientId/projects',
    );
    expect(route).toBeTruthy();
  });
});
