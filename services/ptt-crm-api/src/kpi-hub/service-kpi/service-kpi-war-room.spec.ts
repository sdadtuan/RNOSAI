import { buildWarRoom } from './service-kpi-war-room';

describe('buildWarRoom', () => {
  it('counts assumptions open and at-risk queue', () => {
    const res = buildWarRoom({
      instances: [
        {
          id: 'i1',
          dv_code: 'DV04',
          status: 'AT_RISK',
          assumption_state: 'not_met',
          classification: 'OPTIMIZATION_TARGET',
          client_visible: true,
          target_max: 100000,
          latest_actual: 120000,
        },
      ],
      actuals_pending: 2,
      quotes_high_score: 3,
      gm_by_dv: [{ dv_code: 'DV04', gm_pct: 22.4 }],
      include_gm: true,
    });
    expect(res.assumptions_open).toBeGreaterThan(0);
    expect(res.critical_overdue).toBe(1);
    expect(res.blocked_reports).toBe(2);
    expect(res.quotes_score_gte_70).toBe(3);
    expect(res.dv_health[0]?.gm_pct).toBe(22.4);
  });
});
