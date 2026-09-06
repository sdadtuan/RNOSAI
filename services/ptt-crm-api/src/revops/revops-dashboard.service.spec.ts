import { KpiHubDashboardService } from '../kpi-hub/dashboard/kpi-hub-dashboard.service';
import { RevopsActionsService } from './revops-actions.service';
import { RevopsDashboardService } from './revops-dashboard.service';
import { RevopsTeamPerformanceService } from './revops-team-performance.service';
import type { RevopsDashboardActor } from './revops.types';

function salesHub(overrides: Record<string, unknown> = {}) {
  return {
    persona: 'sales',
    period: { from: '2026-09-01', to: '2026-09-30', timezone: 'Asia/Ho_Chi_Minh', compare: false },
    tiles: [
      {
        code: 'SAL_008',
        name: 'Doanh thu kỳ mới',
        actual: 120_000_000,
        formatted: '120 tr đ',
        target: 150_000_000,
        status: 'WARNING',
        delta_pct: -8.5,
        sparkline: [],
        freshness: 'OK',
      },
      {
        code: 'SAL_005W',
        name: 'Pipeline có trọng số',
        actual: 80_000_000,
        formatted: '80 tr đ',
        target: null,
        status: 'OK',
        delta_pct: null,
        sparkline: [],
        freshness: 'OK',
      },
    ],
    funnel: {
      stages: [
        { code: 'MKT_007', name: 'MQL', value: 12, conversion_from_prev: null },
        { code: 'SAL_001', name: 'SQL', value: 7, conversion_from_prev: 0.58 },
      ],
      bottleneck: { code: 'SAL_001', label: 'SQL' },
    },
    sales: {
      pipeline_stacks: [],
      sla: { actual_minutes: null, target_minutes: 30, buckets: {}, overdue_count: 2 },
      team_rows: [
        {
          staff_id: 9,
          name: 'Lan',
          role: 'AE',
          team_label: 'HN',
          target_vnd: 50_000_000,
          actual_vnd: 45_000_000,
          pipeline_vnd: 20_000_000,
          lead_active: 3,
        },
      ],
      deals_at_risk: [],
      weighted_badge: 'weighted',
    },
    ...overrides,
  };
}

const actor: RevopsDashboardActor = {
  staffId: 1,
  caps: [{ section: 'crm_revops', action: 'view_all' }],
};

describe('RevopsDashboardService', () => {
  it('maps KPI Hub sales revenue, keeps commission null, and stamps ISO fetchedAt', async () => {
    const kpiHub = {
      getDashboard: jest.fn().mockResolvedValue(salesHub()),
    } as unknown as KpiHubDashboardService;
    const actions = {
      todayQueue: jest.fn().mockResolvedValue([]),
      atRisk: jest.fn().mockResolvedValue([]),
    } as unknown as RevopsActionsService;
    const team = new RevopsTeamPerformanceService();
    const svc = new RevopsDashboardService(kpiHub, actions, team);

    const out = await svc.get(actor, { period: '2026-09', bu: 'hn' });

    expect(out.period).toBe('2026-09');
    expect(out.bu).toBe('hn');
    expect(out.revenue).toEqual({
      actualVnd: 120_000_000,
      targetVnd: 150_000_000,
      attainmentPct: 80,
      deltaPct: -8.5,
    });
    expect(out.pipeline.weightedVnd).toBe(80_000_000);
    expect(out.leadSla.atRisk).toBe(2);
    expect(out.funnel).toEqual([
      { stage: 'MQL', count: 12 },
      { stage: 'SQL', count: 7 },
    ]);
    expect(out.teamPerformance).toHaveLength(1);
    expect(out.commission).toEqual({
      estimatedVnd: null,
      approvedVnd: null,
      pendingVnd: null,
    });
    expect(out.commission.estimatedVnd).toBeNull();
    expect(out.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(kpiHub.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ persona: 'sales', from: '2026-09-01', department_id: 'hn' }),
    );
  });

  it('returns null revenue and null commission when KPI Hub is unavailable', async () => {
    const kpiHub = {
      getDashboard: jest.fn().mockRejectedValue(new Error('kpi down')),
    } as unknown as KpiHubDashboardService;
    const actions = {
      todayQueue: jest.fn().mockResolvedValue([]),
      atRisk: jest.fn().mockResolvedValue([]),
    } as unknown as RevopsActionsService;
    const svc = new RevopsDashboardService(kpiHub, actions, new RevopsTeamPerformanceService());

    const out = await svc.get({ staffId: 2, caps: [{ section: 'crm_revops', action: 'view' }] }, {});

    expect(out.revenue.actualVnd).toBeNull();
    expect(out.revenue.targetVnd).toBeNull();
    expect(out.commission.estimatedVnd).toBeNull();
    expect(out.funnel).toEqual([]);
    expect(out.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
