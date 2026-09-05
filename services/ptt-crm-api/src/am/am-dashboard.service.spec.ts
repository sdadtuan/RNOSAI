import { emptyKpis, showCoverage, sumRevenueAtRisk, todayWorkChip } from './am-dashboard.service';

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

  it('sends null at-risk money when at_risk accounts have no recurring', () => {
    const { vnd, count } = sumRevenueAtRisk([{ band: 'at_risk', mrr: null }]);
    expect(count).toBe(1);
    expect(vnd).toBeNull();
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

  it('classifies today_work chip by Asia/Ho_Chi_Minh calendar day', () => {
    const now = new Date('2026-09-05T08:00:00+07:00');
    const dueSameIctDay = new Date('2026-09-05T01:00:00+07:00');
    expect(dueSameIctDay.toISOString().slice(0, 10)).toBe('2026-09-04');
    expect(todayWorkChip(dueSameIctDay, 1, now)).toBe('today');
    expect(todayWorkChip(new Date('2026-09-04T23:00:00+07:00'), 1, now)).toBe('overdue');
    expect(todayWorkChip(new Date('2026-09-06T00:30:00+07:00'), 1, now)).toBe('soon');
    expect(todayWorkChip(dueSameIctDay, null, now)).toBe('unassigned');
  });
});
