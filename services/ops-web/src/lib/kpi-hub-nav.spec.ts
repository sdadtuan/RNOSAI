import { describe, expect, it } from 'vitest';
import {
  KPI_HUB_NAV,
  KPI_HUB_NAV_GROUPS,
  activeKpiHubHref,
  isKpiHubPath,
  kpiHubNavGroupsWithDelivery,
} from './kpi-hub-nav';

describe('kpi-hub-nav', () => {
  it('groups three headings with command centers and governance extras', () => {
    expect(KPI_HUB_NAV_GROUPS.map((g) => g.label)).toEqual(['TỔNG QUAN', 'GOVERNANCE', 'PHÂN TÍCH']);
    expect(KPI_HUB_NAV_GROUPS[0].items.map((i) => i.href)).toEqual([
      '/crm/kpi-hub/executive',
      '/crm/kpi-hub/marketing',
      '/crm/kpi-hub/sales',
    ]);
    expect(KPI_HUB_NAV_GROUPS[1].items.map((i) => i.href)).toContain('/crm/kpi-hub/approvals');
    expect(KPI_HUB_NAV_GROUPS[2].items.map((i) => i.href)).toEqual([
      '/crm/kpi-hub/reports',
      '/crm/kpi-hub/audit',
      '/crm/kpi-hub/settings',
    ]);
    expect(isKpiHubPath('/crm/kpi-hub/executive')).toBe(true);
    expect(activeKpiHubHref('/crm/kpi-hub/executive')).toBe('/crm/kpi-hub/executive');
  });

  it('flat nav includes all grouped items', () => {
    const flatCount = KPI_HUB_NAV_GROUPS.reduce((n, g) => n + g.items.length, 0);
    expect(KPI_HUB_NAV).toHaveLength(flatCount);
  });

  it('delivery path resolves after Wave B helper', () => {
    expect(isKpiHubPath('/crm/delivery-projects/new')).toBe(true);
    const groups = kpiHubNavGroupsWithDelivery();
    expect(groups[0].items.map((i) => i.href)).toContain('/crm/delivery-projects');
    expect(activeKpiHubHref('/crm/delivery-projects')).toBe('/crm/delivery-projects');
  });
});
