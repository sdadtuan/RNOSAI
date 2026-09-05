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

describe('AmAccountsService.patch 360', () => {
  const editReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const agency = { createClient: jest.fn(), updateClient: jest.fn() };
  const db = {
    query: jest.fn<ReturnType<QueryFn>, Parameters<QueryFn>>(),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => VIEW_STAFF_ID),
    me: jest.fn(async () => ({
      caps: [{ section: 'crm_am', action: 'edit' }],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  const accountRow = {
    agency_client_id: CHILD_ID,
    code: 'APC',
    name: 'An Phu Con',
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
  };

  let service: AmAccountsService;
  let scopedParentIds: string[];

  function mockPatchQueries(sql: string) {
    const text = String(sql);
    if (/agency_client_id = ANY\(\$\d+::uuid\[\]\)/i.test(text)) {
      return {
        rows: scopedParentIds.map((id) => ({ agency_client_id: id })),
        rowCount: scopedParentIds.length,
      };
    }
    if (/from crm_am_account_ext e/i.test(text) && /select/i.test(text) && /clients c/i.test(text)) {
      return { rows: [accountRow], rowCount: 1 };
    }
    if (/update\s+crm_am_account_ext/i.test(text)) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    scopedParentIds = [];
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(VIEW_STAFF_ID);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_am', action: 'edit' }] });
    db.query.mockImplementation(async (sql: string) => mockPatchQueries(sql));
    service = new AmAccountsService(agency as never, db as never, staffAuth as never);
  });

  const editActor = {
    staffId: VIEW_STAFF_ID,
    caps: [{ section: 'crm_am', action: 'edit' }],
    via: 'jwt' as const,
  };

  it('returns name_unchanged and does not call AgencyService when caller lacks crm_agency write', async () => {
    const out = await service.patch(editReq, CHILD_ID, { name: 'New Name', tier: 'B' }, editActor);
    expect(agency.updateClient).not.toHaveBeenCalled();
    expect(out.name_unchanged).toBe(true);
    expect(out.name).toBe('An Phu Con');
  });

  it('rejects parent PATCH when parent is missing or out of scope', async () => {
    scopedParentIds = [];
    await expect(
      service.patch(editReq, CHILD_ID, { parent_agency_client_id: OTHER_ID }, editActor),
    ).rejects.toMatchObject({ status: 403, error: 'parent_denied' });
    const updates = db.query.mock.calls.filter((call) => /update\s+crm_am_account_ext/i.test(String(call[0])));
    expect(updates).toHaveLength(0);
  });

  it('rejects parent PATCH with 400 when parent id is invalid', async () => {
    await expect(
      service.patch(editReq, CHILD_ID, { parent_agency_client_id: CHILD_ID }, editActor),
    ).rejects.toMatchObject({ status: 400, error: 'parent_invalid' });
    await expect(
      service.patch(editReq, CHILD_ID, { parent_agency_client_id: 'not-a-uuid' }, editActor),
    ).rejects.toMatchObject({ status: 400, error: 'parent_invalid' });
  });

  it('rejects Active without a primary contact with 400 primary_contact_required', async () => {
    await expect(
      service.patch(editReq, CHILD_ID, { am_status: 'active' }, editActor),
    ).rejects.toMatchObject({ status: 400, error: 'primary_contact_required' });
    const updates = db.query.mock.calls.filter((call) => /update\s+crm_am_account_ext/i.test(String(call[0])));
    expect(updates).toHaveLength(0);
  });

  it('allows Active when the payload includes a primary contact', async () => {
    await expect(
      service.patch(
        editReq,
        CHILD_ID,
        {
          am_status: 'active',
          contacts: [{ full_name: 'Nguyen An Phu', is_primary: true, channel: 'zalo' }],
        },
        editActor,
      ),
    ).resolves.toMatchObject({ agency_client_id: CHILD_ID });
  });

  it('rejects contacts-only PATCH on Active without a named primary', async () => {
    await expect(
      service.patch(
        editReq,
        CHILD_ID,
        { contacts: [{ full_name: 'Nguyen An Phu', is_primary: false }] },
        editActor,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'primary_contact_required' });
    const updates = db.query.mock.calls.filter((call) => /update\s+crm_am_account_ext/i.test(String(call[0])));
    expect(updates).toHaveLength(0);
  });

  it('validates am_status and parent before upserting contacts', async () => {
    await expect(
      service.patch(
        editReq,
        CHILD_ID,
        { am_status: 'nope', contacts: [{ full_name: 'Nguyen An Phu', is_primary: true }] },
        editActor,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'am_status_invalid' });
    await expect(
      service.patch(
        editReq,
        CHILD_ID,
        { parent_agency_client_id: 'not-a-uuid', contacts: [{ full_name: 'Nguyen An Phu', is_primary: true }] },
        editActor,
      ),
    ).rejects.toMatchObject({ status: 400, error: 'parent_invalid' });
    const contactWrites = db.query.mock.calls.filter((call) =>
      /insert\s+into\s+crm_am_contacts|update\s+crm_am_contacts/i.test(String(call[0])),
    );
    expect(contactWrites).toHaveLength(0);
  });

  it('rejects owner_staff_id change without crm_am.assign', async () => {
    await expect(
      service.patch(editReq, CHILD_ID, { owner_staff_id: 99 }, editActor),
    ).rejects.toMatchObject({ status: 403, error: 'missing_cap', action: 'assign' });
    const ownerUpdates = db.query.mock.calls.filter((call) =>
      /update\s+crm_am_account_ext/i.test(String(call[0])),
    );
    expect(ownerUpdates).toHaveLength(0);
  });

  it('allows same owner_staff_id on edit-only and persist industry_override', async () => {
    const out = await service.patch(
      editReq,
      CHILD_ID,
      { owner_staff_id: 7, industry: 'bds' },
      editActor,
    );
    expect(out.agency_client_id).toBe(CHILD_ID);
    const extUpdate = db.query.mock.calls.find((call) => /update\s+crm_am_account_ext/i.test(String(call[0])));
    expect(String(extUpdate?.[0])).toMatch(/industry_override/);
    expect(agency.updateClient).not.toHaveBeenCalled();
  });

  it('writes Agency industry_slug when caller has crm_agency write', async () => {
    const actor = {
      staffId: VIEW_STAFF_ID,
      caps: [
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_agency', action: 'write' },
      ],
      via: 'jwt' as const,
    };
    await service.patch(editReq, CHILD_ID, { industry: 'bds' }, actor);
    expect(agency.updateClient).toHaveBeenCalledWith(
      CHILD_ID,
      expect.objectContaining({ industry_slug: 'bds' }),
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
