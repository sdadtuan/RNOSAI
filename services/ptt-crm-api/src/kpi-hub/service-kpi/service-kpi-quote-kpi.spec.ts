import { classificationToQuoteClass, instanceToQuoteKpi, mergeQuoteKpis } from './service-kpi-quote-kpi';
import type { ServiceKpiInstanceRow } from './service-kpi.types';

const baseInstance: ServiceKpiInstanceRow = {
  id: 'inst-1',
  source_type: 'quote_line_item',
  source_id: 'line-1',
  dv_code: 'DV04',
  dictionary_id: 'CPL',
  template_version_id: 'tpl-v1',
  classification: 'OPTIMIZATION_TARGET',
  status: 'DRAFT',
  client_visible: true,
  owner_name: 'AM',
  target_min: 80_000_000,
  target_max: 150_000_000,
  scenario: 'base',
  assumption_text: 'Giả định A',
  assumption_state: 'pending',
  disclaimer_text: 'Mục tiêu tối ưu',
  row_version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('service-kpi-quote-kpi', () => {
  it('maps classification to quote class slug and Vietnamese label', () => {
    expect(classificationToQuoteClass('COMMITTED_DELIVERABLE')).toBe('committed');
    const row = instanceToQuoteKpi(baseInstance);
    expect(row.class).toBe('optimization_target');
    expect(row.label_vi).toBe('Mục tiêu tối ưu');
    expect(row.value_text).toBe('80000000–150000000');
  });

  it('merges service KPI rows ahead of legacy duplicates', () => {
    const merged = mergeQuoteKpis(
      [{ name: 'CPL', class: 'projected_result', value_text: 'old' }],
      [baseInstance],
      new Map([['CPL', 'P50 CPL BĐS Meta 80tr–150tr = 100.000']]),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.benchmark_hint).toContain('P50 CPL');
  });
});
