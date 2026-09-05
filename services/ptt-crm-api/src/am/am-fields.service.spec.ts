import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmFieldsService } from './am-fields.service';
import { AmController } from './am.controller';
import { AM_REQUIRED_ACTION_KEY } from './guards/staff-am.guard';

const STAFF_ID = 7;
const FIELD_ID = '19d722af-0000-4000-8000-0000000000f1';
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const UNKNOWN_ID = '19d722af-0000-4000-8000-000000000099';

describe('AmFieldsService', () => {
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
  const audit = { insert: jest.fn() };

  let service: AmFieldsService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmFieldsService(repo as never, staffAuth as never, audit as never);
  });

  function fieldRow(overrides: Record<string, unknown> = {}) {
    return {
      id: FIELD_ID,
      api_key: 'project_name',
      label: 'Dự án chính',
      field_type: 'text',
      industry_slug: 'bds',
      required: false,
      filterable: true,
      reportable: true,
      access_json: null,
      constraints_json: null,
      published: false,
      ...overrides,
    };
  }

  it('PATCH api_key after publish returns 409 api_key_immutable', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_am_custom_fields/i.test(sql) && /UPDATE/i.test(sql) === false) {
        return { rows: [fieldRow({ published: true, api_key: 'project_name' })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.patch(FIELD_ID, { api_key: 'project_title' })).rejects.toMatchObject({
      status: 409,
      error: 'api_key_immutable',
    });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE crm_am_custom_fields/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('allows renaming api_key before publish', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/UPDATE crm_am_custom_fields/i.test(sql)) {
        return { rows: [fieldRow({ api_key: 'project_title', published: false })], rowCount: 1 };
      }
      if (/FROM crm_am_custom_fields/i.test(sql)) {
        return { rows: [fieldRow({ published: false, api_key: 'project_name' })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const out = await service.patch(FIELD_ID, { api_key: 'project_title' });
    expect(out.api_key).toBe('project_title');
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE crm_am_custom_fields/i.test(String(sql)))).toBe(
      true,
    );
  });

  it('PUT field-values accepts project_name and leads_per_month for bds', async () => {
    const upserts: unknown[][] = [];
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/FROM crm_am_account_ext/i.test(text) && /industry/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID, industry: 'bds' }], rowCount: 1 };
      }
      if (/FROM crm_am_account_ext/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_custom_fields/i.test(text)) {
        return {
          rows: [
            fieldRow({ published: true, api_key: 'project_name', field_type: 'text' }),
            fieldRow({
              id: '19d722af-0000-4000-8000-0000000000f2',
              published: true,
              api_key: 'leads_per_month',
              label: 'Lead/tháng',
              field_type: 'number',
              constraints_json: { min: 0, max: 10000 },
            }),
          ],
          rowCount: 2,
        };
      }
      if (/INSERT INTO crm_am_field_values/i.test(text)) {
        upserts.push(params ?? []);
        return { rows: [], rowCount: 1 };
      }
      if (/FROM crm_am_field_values/i.test(text)) {
        return {
          rows: [
            { api_key: 'project_name', value_json: 'Vinhomes' },
            { api_key: 'leads_per_month', value_json: 80 },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const out = await service.putValues(viewReq, CLIENT_ID, {
      values: { project_name: 'Vinhomes', leads_per_month: 80 },
    });
    expect(upserts.length).toBeGreaterThanOrEqual(2);
    expect(out.values.project_name).toBe('Vinhomes');
    expect(out.values.leads_per_month).toBe(80);
  });

  it('PUT field-values for out-of-scope client returns 404', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_am_account_ext/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.putValues(viewReq, UNKNOWN_ID, { values: { project_name: 'X' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_am_field_values/i.test(String(sql))),
    ).toBe(false);
  });
});

describe('AmController field and SLA manage caps', () => {
  it('requires manage on field write/publish and SLA write; view/edit on reads and values', () => {
    const proto = AmController.prototype as unknown as Record<string, object>;

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.listFields) ?? '')).toBe('fields');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.listFields)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.listFields)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createField) ?? '')).toBe('fields');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createField)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createField)).toBe('manage');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.patchField) ?? '')).toBe('fields/:id');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.patchField)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.patchField)).toBe('manage');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.publishField) ?? '')).toBe(
      'fields/:id/publish',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.publishField)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.publishField)).toBe('manage');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.getFieldValues) ?? '')).toBe(
      'field-values/:agencyClientId',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getFieldValues)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.getFieldValues)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.putFieldValues) ?? '')).toBe(
      'field-values/:agencyClientId',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.putFieldValues)).toBe(RequestMethod.PUT);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.putFieldValues)).toBe('edit');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.listSlaPolicies) ?? '')).toBe(
      'sla-policies',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.listSlaPolicies)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.listSlaPolicies)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createSlaPolicy) ?? '')).toBe(
      'sla-policies',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createSlaPolicy)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createSlaPolicy)).toBe('manage');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.patchSlaPolicy) ?? '')).toBe(
      'sla-policies/:id',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.patchSlaPolicy)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.patchSlaPolicy)).toBe('manage');
  });
});
