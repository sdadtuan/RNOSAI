import { assertForecastPublishable, visibleInsights } from './performance-insight';

describe('performance-insight', () => {
  it('hides insight without evidence_ids (AC-PM-10)', () => {
    expect(
      visibleInsights([
        { text: 'CPL sẽ về 90K', evidence_ids: [] },
        { text: 'P1 root cause #4412', evidence_ids: ['inc-4412'] },
      ]),
    ).toEqual([{ text: 'P1 root cause #4412', evidence_ids: ['inc-4412'] }]);
  });

  it('blocks client forecast publish without disclaimer', () => {
    expect(() =>
      assertForecastPublishable({ client_facing: true, disclaimer: '' }),
    ).toThrow(/forecast_disclaimer_required/);
    expect(() =>
      assertForecastPublishable({ client_facing: true, disclaimer: 'Theo budget 120tr' }),
    ).not.toThrow();
    expect(() =>
      assertForecastPublishable({ client_facing: false, disclaimer: '' }),
    ).not.toThrow();
  });
});
