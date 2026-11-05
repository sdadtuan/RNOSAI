import { budgetBandLabel, percentile50, percentile80 } from './service-kpi-benchmark';

describe('service-kpi-benchmark', () => {
  it('p50 from [100, 120, 80] = 100', () => {
    expect(percentile50([100, 120, 80])).toBe(100);
  });

  it('p80 picks 80th percentile value', () => {
    expect(percentile80([100, 120, 80, 140])).toBe(140);
  });

  it('budget band label formats VND ranges', () => {
    expect(budgetBandLabel(80_000_000, 150_000_000)).toBe('80tr–150tr');
  });
});
