import {
  buildCommissionLiability,
  buildReportCsv,
  buildRevenueMix,
  buildRevenueTrend,
  isRevopsReportSlug,
  quarterLabel,
  quarterMonths,
  seedReportLibrary,
  sumClawbackVnd,
} from './revops-reports.util';

describe('revops-reports.util', () => {
  it('seeds exactly 4 reports with manual scheduler', () => {
    const items = seedReportLibrary('2026-09-06T10:00:00Z');
    expect(items).toHaveLength(4);
    expect(items.every((r) => r.schedulerStatus === 'manual')).toBe(true);
    expect(items.map((r) => r.slug)).toEqual([
      'executive-revenue-forecast',
      'lead-sla-leakage',
      'key-account-health',
      'commission-payout-reconciliation',
    ]);
  });

  it('builds quarter months and label', () => {
    expect(quarterMonths('2026-09')).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(quarterLabel('2026-09')).toBe('Q3/2026');
  });

  it('builds revenue trend for active month only', () => {
    const trend = buildRevenueTrend('2026-09', 100, 120);
    expect(trend).toHaveLength(3);
    expect(trend[2]).toEqual({
      month: '2026-09',
      label: 'Sep',
      actualVnd: 100,
      forecastVnd: 120,
    });
    expect(trend[0].actualVnd).toBeNull();
  });

  it('builds revenue mix percentages', () => {
    const mix = buildRevenueMix({ newVnd: 52, renewalVnd: 30, upsellVnd: 18 });
    expect(mix.totalVnd).toBe(100);
    expect(mix.rows.map((r) => r.pct)).toEqual([52, 30, 18]);
  });

  it('sums clawback from negative or clawback status', () => {
    expect(
      sumClawbackVnd([
        { commissionVnd: 1_000_000, status: 'approved' },
        { commissionVnd: -1_800_000, status: 'clawback' },
      ]),
    ).toBe(1_800_000);
  });

  it('exports executive CSV', () => {
    const csv = buildReportCsv('executive-revenue-forecast', {
      period: '2026-09',
      bu: 'all',
      territory: 'all',
      revenueTrend: buildRevenueTrend('2026-09', 100, 120),
      revenueMix: buildRevenueMix({ newVnd: 52, renewalVnd: 30, upsellVnd: 18 }),
      commission: buildCommissionLiability({
        estimatedVnd: 10,
        approvedVnd: 6,
        pendingVnd: 4,
        clawbackVnd: 1,
      }),
    });
    expect(csv).toContain('month,actual_vnd,forecast_vnd');
    expect(csv).toContain('2026-09,100,120');
    expect(csv).toContain('mix_key,mix_label,vnd,pct');
  });

  it('validates report slugs', () => {
    expect(isRevopsReportSlug('executive-revenue-forecast')).toBe(true);
    expect(isRevopsReportSlug('unknown')).toBe(false);
  });
});
