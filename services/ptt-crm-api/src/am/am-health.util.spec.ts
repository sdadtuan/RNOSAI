import { bandFromScore, isActiveBook, weightedScore } from './am-health.util';

describe('am-health.util', () => {
  it('maps scores to 4 bands', () => {
    expect(bandFromScore(80)).toBe('healthy');
    expect(bandFromScore(79)).toBe('watch');
    expect(bandFromScore(59)).toBe('at_risk');
    expect(bandFromScore(39)).toBe('critical');
  });

  it('uses settings bands when provided', () => {
    const bands = {
      healthy: [90, 100] as [number, number],
      watch: [70, 89] as [number, number],
      at_risk: [40, 69] as [number, number],
      critical: [0, 39] as [number, number],
    };
    expect(bandFromScore(80, bands)).toBe('watch');
    expect(bandFromScore(90, bands)).toBe('healthy');
  });

  it('weights perfect components to 100', () => {
    expect(
      weightedScore({
        kpi_delivery: 100,
        engagement: 100,
        financial: 100,
        satisfaction: 100,
        contract_support: 100,
      }),
    ).toBe(100);
  });

  it('treats paused as active book and churned as not', () => {
    expect(isActiveBook('churned')).toBe(false);
    expect(isActiveBook('paused')).toBe(true);
  });
});
