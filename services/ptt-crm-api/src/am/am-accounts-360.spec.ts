import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmAccountsService } from './am-accounts.service';
import { AmController } from './am.controller';

const PARENT_ID = '19d722af-0000-4000-8000-000000000001';
const CHILD_ID = '19d722af-0000-4000-8000-000000000002';
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

describe('AmAccountsService.get 360', () => {
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

  it('returns 404 not 200 when the account is out of scope', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.get(viewReq, OTHER_ID)).rejects.toMatchObject({ status: 404 });
    const scoped = db.query.mock.calls.find((call) => {
      const sql = String(call[0]);
      return /crm_am_account_ext/i.test(sql) && /select/i.test(sql);
    });
    expect(scoped).toBeTruthy();
    expect(String(scoped?.[0])).toMatch(/account_owner_staff_id/);
  });

  it('returns children[] when the account is a parent', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'view_all' },
      ],
    });
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_am_account_ext ch/i.test(text) && /parent_agency_client_id/i.test(text)) {
        return {
          rows: [
            {
              agency_client_id: CHILD_ID,
              name: 'An Phu Con',
              code: 'APC',
              owner_label: 'Minh',
              am_status: 'active',
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_account_ext e/i.test(text) && /select/i.test(text) && /clients c/i.test(text)) {
        return {
          rows: [
            {
              agency_client_id: PARENT_ID,
              code: 'AP01',
              name: 'An Phu',
              industry: 'agency',
              notes: null,
              am_status: 'active',
              tier: 'A',
              team_id: 1,
              team_label: 'Enterprise',
              owner_staff_id: 7,
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
      return { rows: [], rowCount: 0 };
    });

    const out = await service.get(viewReq, PARENT_ID);
    expect(Array.isArray(out.children)).toBe(true);
    expect(out.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agency_client_id: CHILD_ID, name: 'An Phu Con' }),
      ]),
    );
  });
});

describe('AmController contract amount', () => {
  it('does not expose PATCH amount on a contract endpoint', () => {
    const patchContractAmount = controllerRoutes().filter((route) => {
      const haystack = `${route.name} ${route.path}`;
      return (
        route.method === RequestMethod.PATCH &&
        /contract/i.test(haystack) &&
        /amount/i.test(haystack)
      );
    });
    expect(patchContractAmount).toEqual([]);
  });
});
