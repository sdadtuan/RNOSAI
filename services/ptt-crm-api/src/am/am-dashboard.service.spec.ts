import {
  AM_CSAT_CLIENTS_JOIN,
  amCsatSql,
  averageCsat,
  coverageOf,
  emptyKpis,
  showCoverage,
  sumRevenueAtRisk,
  todayWorkChip,
} from './am-dashboard.service';

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

  it('CSAT SQL inner-joins clients so orphan scores are dropped from the average', () => {
    const sql = amCsatSql('TRUE');
    expect(sql).toMatch(/INNER JOIN clients/i);
    expect(sql).toContain(AM_CSAT_CLIENTS_JOIN);
    expect(averageCsat([5])).toBe(5);
    expect(averageCsat([])).toBeNull();
  });

  it('CSAT average helper stays null when no rows', () => {
    expect(averageCsat([])).toBeNull();
    expect(averageCsat([null, undefined])).toBeNull();
  });

  it('CSAT average helper averages scores when at least one row exists', () => {
    expect(averageCsat([3, 5])).toBe(4);
    expect(averageCsat([4])).toBe(4);
  });

  it('hides coverage unless team/all and director/admin', () => {
    expect(showCoverage('me', 'director')).toBe(false);
    expect(showCoverage('team', 'am')).toBe(false);
    expect(showCoverage('team', 'director')).toBe(true);
    expect(showCoverage('all', 'admin')).toBe(true);
  });

  it('counts coverage.delegated from active outbound delegations, not backup_staff_id', () => {
    const coverage = coverageOf(
      [
        { account_owner_staff_id: 1, backup_staff_id: 9 },
        { account_owner_staff_id: 2, backup_staff_id: null },
        { account_owner_staff_id: 2, backup_staff_id: 3 },
        { account_owner_staff_id: null, backup_staff_id: 4 },
      ],
      4,
      new Set([2]),
    );
    expect(coverage.delegated).toBe(2);
    expect(coverage.unassigned).toBe(1);
    expect(coverage.qbr_this_week).toBe(4);
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
