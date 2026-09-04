import { describe, expect, it } from 'vitest';
import { KPI_HUB_DASHBOARD, KPI_HUB_DICTIONARY } from './kpi-hub-fixtures';
import { dashboardFiltersToQuery, normalizeDashboard, normalizeDictionaryList } from './kpi-hub-normalize';

describe('kpi-hub-normalize', () => {
  it('falls back to fixtures when dashboard cards missing', () => {
    expect(normalizeDashboard({})).toEqual(KPI_HUB_DASHBOARD);
  });

  it('maps snake_case dashboard payload', () => {
    const out = normalizeDashboard({
      period_label: 'Q3 2026',
      cards: [{ code: 'MKT_001', name: 'Leads', value: 10, formatted: '10', status: 'ACHIEVED', badge: 'OK' }],
      funnel: { stages: [{ code: 'A', name: 'A', value: 1 }], bottleneck: { code: 'B', label: 'B' } },
      target_progress: { overall_pct: 50, groups: [{ code: 'G', label: 'G', pct: 50 }] },
      channels: [{ channel: 'Meta', valid_leads: 1, revenue: 2 }],
      alerts: [{ level: 'INFO', title: 't', scope: 's' }],
      top_sales: [{ rank: 1, name: 'N', revenue: 1, win_rate: 2 }],
    });
    expect(out.periodLabel).toBe('Q3 2026');
    expect(out.cards[0]?.code).toBe('MKT_001');
    expect(out.targetProgress.overallPct).toBe(50);
  });

  it('falls back dictionary list to fixtures', () => {
    const out = normalizeDictionaryList({});
    expect(out.data).toEqual(KPI_HUB_DICTIONARY);
  });

  it('builds dashboard query params', () => {
    expect(dashboardFiltersToQuery({ department: 'MKT', channel: '', team: 'A' })).toEqual({
      department: 'MKT',
      team: 'A',
    });
  });
});
