import { describe, expect, it } from 'vitest';
import { parseKpiTypeDetail, parseKpiTypeList, parseKpiTypeSummary } from './kpi-types-api';

describe('parseKpiTypeList', () => {
  it('parses list from data wrapper', () => {
    const out = parseKpiTypeList({
      data: [
        {
          id: 't1',
          code: 'MQL_COUNT',
          name: 'MQL',
          direction: 'INCREASE',
          calculation_mode: 'AUTO',
          status: 'DRAFT',
          kpi_group: { id: 'g1', name: 'Tăng trưởng', color: '#17B6A4' },
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    });
    expect(out.data[0].code).toBe('MQL_COUNT');
    expect(out.meta.total).toBe(1);
  });
});

describe('parseKpiTypeDetail', () => {
  it('includes formula and row_version', () => {
    const detail = parseKpiTypeDetail({
      id: 't1',
      code: 'MQL_COUNT',
      name: 'MQL',
      direction: 'INCREASE',
      status: 'DRAFT',
      formula_expression: 'COUNT(Lead)',
      row_version: 2,
      default_target: 1200,
    });
    expect(detail?.formula_expression).toBe('COUNT(Lead)');
    expect(detail?.row_version).toBe(2);
  });
});

describe('parseKpiTypeSummary', () => {
  it('parses summary counts', () => {
    expect(parseKpiTypeSummary({ total: 10, active: 4, draft: 5, auto: 3 })).toEqual({
      total: 10,
      active: 4,
      draft: 5,
      auto: 3,
    });
  });
});
