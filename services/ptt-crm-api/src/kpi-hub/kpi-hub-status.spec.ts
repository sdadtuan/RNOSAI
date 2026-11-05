import {
  achievementPct,
  deriveHubStatus,
  freshnessStatus,
  hasFormulaCycle,
  ratioPeriod,
} from './kpi-hub-status';

describe('kpi-hub-status', () => {
  it('CPL 142k vs target 150k warn 180k crit 220k → ACHIEVED', () => {
    expect(
      deriveHubStatus({
        direction: 'LOWER_IS_BETTER',
        actual: 142000,
        target: 150000,
        warning: 180000,
        critical: 220000,
      }),
    ).toBe('ACHIEVED');
  });

  it('MQL 24.8 vs target 30 → WARNING', () => {
    expect(
      deriveHubStatus({
        direction: 'HIGHER_IS_BETTER',
        actual: 24.8,
        target: 30,
        warning: null,
        critical: 20,
      }),
    ).toBe('WARNING');
  });

  it('Win 12.5 vs target 20 crit 20 → CRITICAL', () => {
    expect(
      deriveHubStatus({
        direction: 'HIGHER_IS_BETTER',
        actual: 12.5,
        target: 20,
        warning: null,
        critical: 20,
      }),
    ).toBe('CRITICAL');
  });

  it('ratio blank-if-zero', () => {
    expect(ratioPeriod(100, 0, true)).toBeNull();
  });

  it('non-additive: không avg tỷ lệ ngày', () => {
    expect(ratioPeriod(300, 2, false)).toBe(150);
  });

  it('cycle A→B→A', () => {
    expect(
      hasFormulaCycle([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ]),
    ).toBe(true);
  });

  it('SharePoint trễ > SLA → DELAYED', () => {
    expect(
      freshnessStatus(
        new Date('2026-09-04T06:30:00+07:00'),
        60,
        false,
        new Date('2026-09-04T08:45:00+07:00'),
      ),
    ).toBe('DELAYED');
  });

  it('achievementPct higher is better', () => {
    expect(achievementPct('HIGHER_IS_BETTER', 25, 30)).toBeCloseTo(83.3, 1);
  });
});
