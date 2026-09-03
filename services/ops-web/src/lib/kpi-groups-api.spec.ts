import { describe, expect, it } from 'vitest';
import {
  parseKpiGroupAudit,
  parseKpiGroupDetail,
  parseKpiGroupList,
  parseKpiGroupSummary,
} from './kpi-groups-api';

describe('parseKpiGroupList', () => {
  it('parses list from data wrapper', () => {
    const out = parseKpiGroupList({
      data: [
        {
          id: 'g1',
          code: 'GROWTH_CONVERSION',
          name: 'Tăng trưởng',
          scope_type: 'DEPARTMENT',
          departments: [{ id: 'd1', name: 'Marketing' }],
          default_direction: 'INCREASE',
          color: '#17B6A4',
          display_order: 1,
          status: 'ACTIVE',
          usage_count: 3,
          updated_at: '2026-09-03T10:00:00+07:00',
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    });
    expect(out.data[0].code).toBe('GROWTH_CONVERSION');
    expect(out.meta.total).toBe(1);
  });

  it('parses bare array response', () => {
    const out = parseKpiGroupList([
      {
        id: 'g2',
        code: 'BRAND',
        name: 'Thương hiệu',
        scope_type: 'ORGANIZATION',
        default_direction: 'INCREASE',
        status: 'DRAFT',
      },
    ]);
    expect(out.data[0].name).toBe('Thương hiệu');
  });

  it('returns empty for invalid body', () => {
    expect(parseKpiGroupList(null).data).toEqual([]);
  });
});

describe('parseKpiGroupDetail', () => {
  it('includes junction fields and row_version', () => {
    const detail = parseKpiGroupDetail({
      id: 'g1',
      code: 'REVENUE',
      name: 'Doanh thu',
      scope_type: 'POSITION',
      default_direction: 'INCREASE',
      status: 'ACTIVE',
      department_ids: ['d1'],
      position_ids: [10],
      suggested_unit_types: ['CURRENCY'],
      data_domains: ['CRM'],
      row_version: 4,
    });
    expect(detail?.row_version).toBe(4);
    expect(detail?.position_ids).toEqual([10]);
  });
});

describe('parseKpiGroupSummary', () => {
  it('parses summary counts', () => {
    expect(parseKpiGroupSummary({ total: 10, active: 6, draft: 2, inactive: 2 })).toEqual({
      total: 10,
      active: 6,
      draft: 2,
      inactive: 2,
    });
  });
});

describe('parseKpiGroupAudit', () => {
  it('parses audit entries', () => {
    const out = parseKpiGroupAudit({
      data: [
        {
          id: 'a1',
          action: 'UPDATE',
          performed_by: { id: 1, name: 'Admin' },
          performed_at: '2026-09-03T12:00:00+07:00',
        },
      ],
    });
    expect(out.data[0].action).toBe('UPDATE');
    expect(out.data[0].performed_by.name).toBe('Admin');
  });
});
