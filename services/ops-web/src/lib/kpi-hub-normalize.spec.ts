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
    expect(out.data.length).toBe(KPI_HUB_DICTIONARY.length);
    expect(out.summary).toEqual({ total: 22, active: 20, needReview: 1, sources: 7 });
  });

  it('maps snake_case dictionary list payload', () => {
    const out = normalizeDictionaryList({
      items: [
        {
          id: 'abc',
          code: 'MKT_006',
          name: 'CPL Valid Lead',
          kpi_group: 'Media Efficiency',
          kpi_group_color: '#10B981',
          primary_source: 'Ads + CRM',
          sync_frequency: 'Hàng ngày 08:00',
          data_owner: { name: 'Nguyễn Thị Lan', email: 'data@ptt.vn' },
          kpi_owner: { name: 'Performance MKT', email: 'perf@ptt.vn' },
          status: 'ACTIVE',
          description: 'Chi phí trên mỗi Valid Lead.',
          updated_at: new Date().toISOString(),
        },
      ],
      summary: { total: 1, active: 1, need_review: 0, sources: 2 },
      meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    });
    expect(out.data[0]?.code).toBe('MKT_006');
    expect(out.data[0]?.frequency).toBe('Daily');
    expect(out.data[0]?.dataOwnerRole).toBe('Performance MKT');
    expect(out.meta?.total).toBe(1);
  });

  it('builds dashboard query params', () => {
    expect(dashboardFiltersToQuery({ department: 'MKT', channel: '', team: 'A' })).toEqual({
      department: 'MKT',
      team: 'A',
    });
  });
});
