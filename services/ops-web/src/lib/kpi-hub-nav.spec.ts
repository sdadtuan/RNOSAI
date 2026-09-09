import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from './auth';
import {
  KPI_HUB_NAV,
  KPI_HUB_NAV_GROUPS,
  SERVICE_KPI_NAV_GROUP,
  activeKpiHubHref,
  filterKpiHubNavGroupsForUser,
  isKpiHubPath,
  kpiHubNavGroup,
  kpiHubNavGroupsForUser,
  kpiHubNavGroupsWithDelivery,
} from './kpi-hub-nav';

function userWithCaps(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: 'u1',
    email: 'test@ptt.vn',
    display_name: 'Test',
    position_code: 'CEO',
    caps,
  } as StoredStaffUser;
}

describe('kpi-hub-nav', () => {
  it('groups five headings including Performance Management', () => {
    expect(KPI_HUB_NAV_GROUPS.map((g) => g.label)).toEqual([
      'TỔNG QUAN',
      'GOVERNANCE',
      'SERVICE KPI',
      'HIỆU SUẤT',
      'PHÂN TÍCH',
    ]);
    expect(KPI_HUB_NAV_GROUPS[0].items.map((i) => i.href)).toEqual([
      '/crm/kpi-hub/executive',
      '/crm/kpi-hub/marketing',
      '/crm/kpi-hub/sales',
    ]);
    expect(KPI_HUB_NAV_GROUPS[1].items.map((i) => i.href)).toContain('/crm/kpi-hub/approvals');
    expect(KPI_HUB_NAV_GROUPS[2].items.map((i) => i.href)).toContain('/crm/kpi-hub/service-kpi');
    expect(KPI_HUB_NAV_GROUPS[3].items.map((i) => i.href)).toContain('/crm/kpi-hub/performance');
    expect(KPI_HUB_NAV_GROUPS[3].items).toHaveLength(11);
    expect(KPI_HUB_NAV_GROUPS[3].items.map((i) => i.label)).toEqual([
      'Operating Dashboard',
      'Assignment Registry',
      'Tạo Assignment',
      'Scorecard Builder',
      'Thêm chỉ tiêu',
      'Check-in Ritual',
      'Marketing OS',
      'Campaign Control',
      'CRM Source Map',
      'Snapshot Report',
      'Policy',
    ]);
    expect(KPI_HUB_NAV_GROUPS[4].items.map((i) => i.href)).toEqual([
      '/crm/kpi-hub/reports',
      '/crm/kpi-hub/audit',
      '/crm/kpi-hub/settings',
    ]);
    expect(isKpiHubPath('/crm/kpi-hub/executive')).toBe(true);
    expect(activeKpiHubHref('/crm/kpi-hub/executive')).toBe('/crm/kpi-hub/executive');
  });

  it('exports SERVICE KPI group with war room and reconcile', () => {
    expect(SERVICE_KPI_NAV_GROUP.label).toBe('SERVICE KPI');
    expect(kpiHubNavGroup('service-kpi')?.items.map((i) => i.href)).toContain('/crm/kpi-hub/reconcile');
    expect(SERVICE_KPI_NAV_GROUP.items.length).toBeGreaterThanOrEqual(8);
  });

  it('flat nav includes all grouped items', () => {
    const flatCount = KPI_HUB_NAV_GROUPS.reduce((n, g) => n + g.items.length, 0);
    expect(KPI_HUB_NAV).toHaveLength(flatCount);
  });

  it('hides SERVICE KPI group without crm_kpi_hub.view', () => {
    const dictOnly = userWithCaps([{ section: 'crm_kpi_dictionary', action: 'view' }]);
    const groups = filterKpiHubNavGroupsForUser(KPI_HUB_NAV_GROUPS, dictOnly);
    expect(groups.map((g) => g.label)).not.toContain('SERVICE KPI');
    expect(groups.map((g) => g.label)).toContain('GOVERNANCE');

    const hubView = userWithCaps([{ section: 'crm_kpi_hub', action: 'view' }]);
    const withService = kpiHubNavGroupsForUser(hubView);
    expect(withService.map((g) => g.label)).toContain('SERVICE KPI');
    expect(withService.map((g) => g.label)).toContain('HIỆU SUẤT');
    expect(groups.map((g) => g.label)).not.toContain('HIỆU SUẤT');
  });

  it('delivery path resolves after Wave B helper', () => {
    expect(isKpiHubPath('/crm/delivery-projects/new')).toBe(true);
    const groups = kpiHubNavGroupsWithDelivery();
    expect(groups[0].items.map((i) => i.href)).toContain('/crm/delivery-projects');
    expect(activeKpiHubHref('/crm/delivery-projects')).toBe('/crm/delivery-projects');
  });
});
