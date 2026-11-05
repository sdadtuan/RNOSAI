import { CeoCommandBriefingService } from './ceo-command-briefing.service';
import type { CeoTowerSensorService } from './ceo-tower-sensor.service';

describe('CeoCommandBriefingService', () => {
  const opsDashboard = { getExecutiveDashboard: jest.fn() };
  const ops = { listAlerts: jest.fn() };
  const pipelineRisk = { listAtRiskDeals: jest.fn() };
  const nlQuery = { runQuery: jest.fn() };
  const managerCoach = { getCurrentDigest: jest.fn() };
  const tower = { buildPayload: jest.fn() };

  let svc: CeoCommandBriefingService;

  const actor = {
    staffId: 7,
    staffLabel: 'ceo',
    caps: [{ section: 'ceo_command', action: 'view' }, { section: 'ops', action: 'view' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new CeoCommandBriefingService(
      opsDashboard as never,
      ops as never,
      pipelineRisk as never,
      nlQuery as never,
      managerCoach as never,
      tower as unknown as CeoTowerSensorService,
    );
    opsDashboard.getExecutiveDashboard.mockResolvedValue({
      summary: { alerts_open: 0, kpi_dat_pct: 90 },
    });
    ops.listAlerts.mockResolvedValue({ items: [] });
    pipelineRisk.listAtRiskDeals.mockResolvedValue({ data: { deals: [] } });
    nlQuery.runQuery.mockResolvedValue({ data: { rows: [{ breach: 0, warning: 0 }] } });
    managerCoach.getCurrentDigest.mockResolvedValue({ data: null });
  });

  it('briefing_today calls tower.buildPayload with shared sensor query', async () => {
    tower.buildPayload.mockResolvedValue({
      ok: true,
      exceptions: [
        {
          severity: 'red',
          title_vi: 'Lead quá hạn B2',
          href: '/crm/leads/42',
          suggest_action: 'assign_lead',
        },
        {
          severity: 'amber',
          title_vi: 'Lead vàng',
          href: '/crm/leads/43',
          suggest_action: null,
        },
      ],
      degraded: [],
    });

    const out = await svc.compose('briefing_today', actor);

    expect(tower.buildPayload).toHaveBeenCalledWith(actor, {
      factory: 'both',
      severity: 'red,amber',
      limit: '8',
    });
    expect(out.cards.some((c) => c.source === 'tower' && c.href === '/crm/leads/42')).toBe(true);
    expect(out.cards.some((c) => c.source === 'tower' && c.href === '/crm/leads/43')).toBe(false);
  });

  it('briefing_today merges tower degraded on failure', async () => {
    tower.buildPayload.mockRejectedValue(new Error('timeout'));

    const out = await svc.compose('briefing_today', actor);

    expect(out.degraded.some((d) => d.source === 'tower')).toBe(true);
  });

  it('briefing_today merges tower payload degraded entries', async () => {
    tower.buildPayload.mockResolvedValue({
      ok: true,
      exceptions: [],
      degraded: [{ source: 'tower_repo', reason: 'partial' }],
    });

    const out = await svc.compose('briefing_today', actor);

    expect(out.degraded.some((d) => d.source === 'tower_repo')).toBe(true);
  });

  it('briefing_ops does not call tower', async () => {
    await svc.compose('briefing_ops', actor);
    expect(tower.buildPayload).not.toHaveBeenCalled();
  });
});
