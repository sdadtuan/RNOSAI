import { describe, expect, it } from 'vitest';
import { KPI_HUB_NAV } from './kpi-hub-nav';

describe('kpi-hub-nav', () => {
  it('has 7 sidebar items in correct order', () => {
    expect(KPI_HUB_NAV).toHaveLength(7);
    expect(KPI_HUB_NAV.map((i) => i.label)).toEqual([
      'Dashboard',
      'KPI Dictionary',
      'Target & Cảnh báo',
      'Nguồn dữ liệu',
      'Data Quality',
      'Báo cáo',
      'Cài đặt',
    ]);
  });
});
