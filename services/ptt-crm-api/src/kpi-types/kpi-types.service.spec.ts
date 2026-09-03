import { KPI_TYPE_ERROR_CODES } from './kpi-types.types';
import { KpiTypesService } from './kpi-types.service';

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    tenant_id: 'PTT',
    kpi_group_id: 'g1',
    code: 'MQL_COUNT',
    name: 'Marketing Qualified Leads (MQL)',
    short_name: 'MQL',
    description: null,
    direction: 'INCREASE',
    value_type: 'INTEGER',
    unit_id: 'u1',
    decimal_places: 0,
    target_mode: 'THRESHOLD',
    minimum_target: 900,
    default_target: 1200,
    stretch_target: 1500,
    lower_limit: null,
    upper_limit: null,
    calculation_mode: 'MANUAL',
    primary_data_source_id: null,
    data_entity: null,
    aggregation_type: null,
    formula_expression: null,
    formula_display: null,
    sync_frequency: null,
    timezone: 'Asia/Ho_Chi_Minh',
    divide_by_zero_fallback: 'ERROR',
    manual_evidence_required: true,
    scope_type: 'ORGANIZATION',
    weight_min: null,
    weight_max: null,
    display_order: 1,
    status: 'DRAFT',
    is_system_default: false,
    current_version: 1,
    created_by_staff_id: 1,
    updated_by_staff_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    deleted_by_staff_id: null,
    row_version: 1,
    department_ids: [],
    position_ids: [],
    departments: [],
    positions: [],
    usage_count: 0,
    updated_by_name: 'Admin',
    kpi_group: { id: 'g1', code: 'GROWTH_CONVERSION', name: 'Tăng trưởng', color: '#17B6A4' },
    unit: { id: 'u1', code: 'LEAD', name: 'Lead' },
    data_source: null,
    validation_status: 'NOT_TESTED',
    ...overrides,
  };
}

describe('KpiTypesService.create', () => {
  const audit = { insert: jest.fn(async () => undefined) };
  const connectors = { checkHealth: jest.fn(), preview: jest.fn() };

  it('creates when group is ACTIVE', async () => {
    const repo = {
      getActiveGroup: jest.fn(async () => ({ id: 'g1', status: 'ACTIVE' })),
      codeExists: jest.fn(async () => false),
      nameExists: jest.fn(async () => false),
      nextDisplayOrder: jest.fn(async () => 3),
      insertType: jest.fn(async () => baseRow()),
      toDetail: jest.fn((row: { id: string }) => row),
    };
    const svc = new KpiTypesService(repo as never, audit as never, connectors as never);
    const out = await svc.create(
      { staffId: 1, canConfigure: true },
      {
        kpi_group_id: 'g1',
        code: 'MQL_COUNT',
        name: 'Marketing Qualified Leads (MQL)',
        direction: 'INCREASE',
        value_type: 'INTEGER',
        unit_id: 'u1',
        target_mode: 'THRESHOLD',
        minimum_target: 900,
        default_target: 1200,
        stretch_target: 1500,
        calculation_mode: 'MANUAL',
        scope_type: 'ORGANIZATION',
      },
    );
    expect(out.id).toBe('t1');
    expect(repo.insertType).toHaveBeenCalled();
  });

  it('rejects INACTIVE group', async () => {
    const repo = {
      getActiveGroup: jest.fn(async () => ({ id: 'g1', status: 'INACTIVE' })),
    };
    const svc = new KpiTypesService(repo as never, audit as never, connectors as never);
    await expect(
      svc.create(
        { staffId: 1, canConfigure: true },
        {
          kpi_group_id: 'g1',
          code: 'MQL_COUNT',
          name: 'Marketing Qualified Leads (MQL)',
          direction: 'INCREASE',
          value_type: 'INTEGER',
          unit_id: 'u1',
          target_mode: 'SINGLE_TARGET',
          default_target: 10,
          calculation_mode: 'MANUAL',
          scope_type: 'ORGANIZATION',
        },
      ),
    ).rejects.toMatchObject({ response: { error: KPI_TYPE_ERROR_CODES.GROUP_INACTIVE } });
  });

  it('rejects duplicate code', async () => {
    const repo = {
      getActiveGroup: jest.fn(async () => ({ id: 'g1', status: 'ACTIVE' })),
      codeExists: jest.fn(async () => true),
    };
    const svc = new KpiTypesService(repo as never, audit as never, connectors as never);
    await expect(
      svc.create(
        { staffId: 1, canConfigure: true },
        {
          kpi_group_id: 'g1',
          code: 'MQL_COUNT',
          name: 'Marketing Qualified Leads (MQL)',
          direction: 'INCREASE',
          value_type: 'INTEGER',
          unit_id: 'u1',
          target_mode: 'SINGLE_TARGET',
          default_target: 10,
          calculation_mode: 'MANUAL',
          scope_type: 'ORGANIZATION',
        },
      ),
    ).rejects.toMatchObject({ response: { error: KPI_TYPE_ERROR_CODES.CODE_DUPLICATE } });
  });
});

describe('KpiTypesService.delete / activate', () => {
  const audit = { insert: jest.fn(async () => undefined) };
  const connectors = {
    checkHealth: jest.fn(async () => 'HEALTHY'),
    preview: jest.fn(),
  };

  it('blocks delete when usage_count > 0', async () => {
    const repo = {
      getTypeById: jest.fn(async () => baseRow({ usage_count: 2 })),
      getUsageCount: jest.fn(async () => 2),
    };
    const svc = new KpiTypesService(repo as never, audit as never, connectors as never);
    await expect(svc.delete({ staffId: 1, canConfigure: true }, 't1')).rejects.toMatchObject({
      response: { error: KPI_TYPE_ERROR_CODES.DELETE_REFERENCED },
    });
  });

  it('blocks AUTO activate when formula is not VALID', async () => {
    const repo = {
      getTypeById: jest.fn(async () =>
        baseRow({
          calculation_mode: 'AUTO',
          primary_data_source_id: 's1',
          formula_expression: 'COUNT(Lead)',
          validation_status: 'NOT_TESTED',
        }),
      ),
      getActiveGroup: jest.fn(async () => ({ id: 'g1', status: 'ACTIVE' })),
    };
    const svc = new KpiTypesService(repo as never, audit as never, connectors as never);
    await expect(
      svc.changeStatus({ staffId: 1, canConfigure: true }, 't1', { status: 'ACTIVE' }),
    ).rejects.toMatchObject({ response: { error: KPI_TYPE_ERROR_CODES.ACTIVATE_INVALID } });
  });
});
