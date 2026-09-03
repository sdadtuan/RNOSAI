import { KPI_GROUP_ERROR_CODES } from './kpi-groups.types';
import { KpiGroupsService } from './kpi-groups.service';

describe('KpiGroupsService.create', () => {
  const audit = { insert: jest.fn(async () => undefined) };

  it('auto-assigns display_order when omitted (BR-07)', async () => {
    const repo = {
      codeExists: jest.fn(async () => false),
      nameExists: jest.fn(async () => false),
      nextDisplayOrder: jest.fn(async () => 6),
      insertGroup: jest.fn(async (_staffId: number, body: { display_order: number }) => ({
        id: 'g1',
        code: 'NEW_GROUP',
        name: 'New',
        status: 'DRAFT',
        scope_type: 'ORGANIZATION',
        display_order: body.display_order,
        default_direction: 'INCREASE',
        tenant_id: 'PTT',
        parent_id: null,
        description: null,
        color: '#17B6A4',
        icon: null,
        is_system_default: false,
        created_by_staff_id: 1,
        updated_by_staff_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by_staff_id: null,
        row_version: 1,
        department_ids: [],
        position_ids: [],
        suggested_unit_types: [],
        data_domains: [],
        usage_count: 0,
        updated_by_name: 'Admin',
      })),
      toDetail: jest.fn((row: { id: string }) => ({ ...row, departments: [], positions: [], updated_by: null })),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    await svc.create({ staffId: 1, canConfigure: false }, {
      code: 'NEW_GROUP',
      name: 'New Group Name',
      scope_type: 'ORGANIZATION',
      default_direction: 'INCREASE',
    });
    expect(repo.nextDisplayOrder).toHaveBeenCalled();
    expect(repo.insertGroup).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ display_order: 6 }),
    );
  });

  it('rejects duplicate code (AC-02)', async () => {
    const repo = {
      codeExists: jest.fn(async () => true),
      nameExists: jest.fn(async () => false),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    await expect(
      svc.create({ staffId: 1, canConfigure: false }, {
        code: 'GROWTH_CONVERSION',
        name: 'Test Group Name',
        scope_type: 'ORGANIZATION',
        default_direction: 'INCREASE',
      }),
    ).rejects.toMatchObject({
      response: { error: KPI_GROUP_ERROR_CODES.CODE_DUPLICATE },
    });
  });
});

describe('KpiGroupsService.update', () => {
  const audit = { insert: jest.fn(async () => undefined) };

  it('blocks code change when usage_count > 0 (FR-03)', async () => {
    const repo = {
      getGroupById: jest.fn(async () => ({
        id: 'g1',
        code: 'OLD_CODE',
        name: 'Old',
        status: 'ACTIVE',
        scope_type: 'ORGANIZATION',
        display_order: 1,
        usage_count: 3,
        is_system_default: false,
        default_direction: 'INCREASE',
        department_ids: [],
        position_ids: [],
      })),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    await expect(
      svc.update({ staffId: 1, canConfigure: false }, 'g1', { code: 'NEW_CODE' }, 1),
    ).rejects.toMatchObject({
      response: { error: KPI_GROUP_ERROR_CODES.CODE_LOCKED },
    });
  });

  it('blocks system default code edit without configure (BR-09)', async () => {
    const repo = {
      getGroupById: jest.fn(async () => ({
        id: 'g1',
        code: 'GROWTH_CONVERSION',
        name: 'Growth',
        status: 'ACTIVE',
        scope_type: 'ORGANIZATION',
        display_order: 1,
        usage_count: 0,
        is_system_default: true,
        default_direction: 'INCREASE',
        department_ids: [],
        position_ids: [],
      })),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    await expect(
      svc.update({ staffId: 1, canConfigure: false }, 'g1', { code: 'OTHER_CODE' }, 1),
    ).rejects.toMatchObject({
      response: { error: KPI_GROUP_ERROR_CODES.SYSTEM_CODE_LOCKED },
    });
  });
});

describe('KpiGroupsService.delete', () => {
  const audit = { insert: jest.fn(async () => undefined) };

  it('blocks delete when referenced (FR-06)', async () => {
    const repo = {
      getGroupById: jest.fn(async () => ({
        id: 'g1',
        code: 'X',
        name: 'X',
        status: 'ACTIVE',
        scope_type: 'ORGANIZATION',
        display_order: 1,
      })),
      getUsageCount: jest.fn(async () => 5),
      softDeleteGroup: jest.fn(),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    await expect(svc.delete({ staffId: 1, canConfigure: false }, 'g1')).rejects.toMatchObject({
      response: { error: KPI_GROUP_ERROR_CODES.DELETE_REFERENCED, usage_count: 5 },
    });
    expect(repo.softDeleteGroup).not.toHaveBeenCalled();
  });
});

describe('KpiGroupsService.duplicate', () => {
  const audit = { insert: jest.fn(async () => undefined) };

  it('creates DRAFT copy (BR-10)', async () => {
    const repo = {
      getGroupById: jest.fn(async () => ({
        id: 'g1',
        code: 'SRC',
        name: 'Source',
        description: 'desc',
        scope_type: 'ORGANIZATION',
        default_direction: 'INCREASE',
        color: '#17B6A4',
        icon: null,
        department_ids: [],
        position_ids: [],
        suggested_unit_types: [],
        data_domains: [],
      })),
      codeExists: jest.fn(async () => false),
      nameExists: jest.fn(async () => false),
      nextDisplayOrder: jest.fn(async () => 2),
      insertGroup: jest.fn(async () => ({
        id: 'g2',
        code: 'COPY',
        name: 'Source - Bản sao',
        status: 'DRAFT',
        scope_type: 'ORGANIZATION',
        display_order: 2,
        default_direction: 'INCREASE',
        tenant_id: 'PTT',
        parent_id: null,
        description: 'desc',
        color: '#17B6A4',
        icon: null,
        is_system_default: false,
        created_by_staff_id: 1,
        updated_by_staff_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by_staff_id: null,
        row_version: 1,
        department_ids: [],
        position_ids: [],
        suggested_unit_types: [],
        data_domains: [],
        usage_count: 0,
        updated_by_name: null,
      })),
      toDetail: jest.fn((row: { status: string }) => ({ ...row, departments: [], positions: [], updated_by: null })),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    const result = await svc.duplicate({ staffId: 1, canConfigure: false }, 'g1', { code: 'COPY' });
    expect(repo.insertGroup).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'DRAFT', code: 'COPY' }),
    );
    expect(result.status).toBe('DRAFT');
  });
});

describe('KpiGroupsService.importRows', () => {
  it('imports valid rows and reports failures', async () => {
    const audit = { insert: jest.fn(async () => undefined) };
    const repo = {
      codeExists: jest.fn(async (code: string) => code === 'DUP'),
      nameExists: jest.fn(async () => false),
      nextDisplayOrder: jest.fn(async () => 3),
      insertGroup: jest.fn(async () => ({
        id: 'g-new',
        code: 'OK_ROW',
        name: 'OK',
        status: 'DRAFT',
        scope_type: 'ORGANIZATION',
        display_order: 3,
        default_direction: 'INCREASE',
        tenant_id: 'PTT',
        parent_id: null,
        description: null,
        color: '#17B6A4',
        icon: null,
        is_system_default: false,
        created_by_staff_id: 1,
        updated_by_staff_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by_staff_id: null,
        row_version: 1,
        department_ids: [],
        position_ids: [],
        suggested_unit_types: [],
        data_domains: [],
        usage_count: 0,
        updated_by_name: null,
      })),
      toDetail: jest.fn((row: { id: string; code: string }) => ({
        ...row,
        departments: [],
        positions: [],
        updated_by: null,
      })),
    };
    const svc = new KpiGroupsService(repo as never, audit as never);
    const out = await svc.importRows({ staffId: 1, canConfigure: true }, {
      rows: [
        {
          code: 'OK_ROW',
          name: 'OK Row Name',
          scope_type: 'ORGANIZATION',
          default_direction: 'INCREASE',
        },
        {
          code: 'DUP',
          name: 'Duplicate Row Name',
          scope_type: 'ORGANIZATION',
          default_direction: 'INCREASE',
        },
      ],
    });
    expect(out.created).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.results[1]?.error).toBe(KPI_GROUP_ERROR_CODES.CODE_DUPLICATE);
  });
});
