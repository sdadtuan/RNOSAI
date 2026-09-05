import { emptyKpis, showCoverage, sumRevenueAtRisk } from './am-dashboard.service';

describe('am-dashboard.service', () => {
  it('counts revenue at risk only for at_risk ∪ critical', () => {
    const rows = [
      { band: 'watch', mrr: 100 },
      { band: 'at_risk', mrr: 50 },
      { band: 'critical', mrr: 20 },
      { band: 'healthy', mrr: 80 },
    ];
    const { vnd, count } = sumRevenueAtRisk(rows);
    expect(vnd).toBe(70);
    expect(count).toBe(2);
  });

  it('returns null KPIs for empty book', () => {
    const kpis = emptyKpis();
    expect(kpis.active_accounts).toBeNull();
    expect(kpis.mrr_vnd).toBeNull();
    expect(kpis.csat).toBeNull();
    expect(kpis.renewal_90d_vnd).toBeNull();
    expect(kpis.revenue_at_risk_vnd).toBeNull();
    expect(kpis.sla_overdue).toBeNull();
    expect(kpis.deltas).toBeUndefined();
  });

  it('hides coverage unless team/all and director/admin', () => {
    expect(showCoverage('me', 'director')).toBe(false);
    expect(showCoverage('team', 'am')).toBe(false);
    expect(showCoverage('team', 'director')).toBe(true);
    expect(showCoverage('all', 'admin')).toBe(true);
  });
});
