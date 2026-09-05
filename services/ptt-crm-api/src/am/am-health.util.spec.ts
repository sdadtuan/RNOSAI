import { bandFromScore, isActiveBook, weightedScore } from './am-health.util';

describe('am-health.util', () => {
  it('maps scores to 4 bands', () => {
    expect(bandFromScore(80)).toBe('healthy');
    expect(bandFromScore(79)).toBe('watch');
    expect(bandFromScore(59)).toBe('at_risk');
    expect(bandFromScore(39)).toBe('critical');
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
