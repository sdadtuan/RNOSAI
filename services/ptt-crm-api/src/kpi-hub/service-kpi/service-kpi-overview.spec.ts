import { buildServiceKpiOverview } from './service-kpi-overview';

describe('buildServiceKpiOverview', () => {
  it('computes tracking pct from plan coverage', () => {
    const res = buildServiceKpiOverview({
      templates_active: 87,
      instances_total: 100,
      instances_tracking: 90,
      instances_with_plan: 93,
      readiness_warning: 187,
      readiness_blocking: 71,
      at_risk: 4,
      at_risk_critical: 2,
    });
    expect(res.instances_tracking_pct).toBe(93);
    expect(res.templates_active).toBe(87);
    expect(res.at_risk_critical).toBe(2);
  });
});
