import { forecastCredits } from './cp-forecast.util';

describe('forecastCredits', () => {
  it('sums scheduled batch, historical average, and reserved', () => {
    const out = forecastCredits({
      scheduled_batch_credits: 10,
      historical_avg: 5,
      reserved: 2,
    });
    expect(out.forecast).toBe(17);
    expect(out.assumption).toMatch(/scheduled_batch_credits/i);
    expect(out.assumption).toMatch(/historical_avg/i);
    expect(out.assumption).toMatch(/reserved/i);
  });

  it('returns null forecast when every input is missing', () => {
    const out = forecastCredits({
      scheduled_batch_credits: null,
      historical_avg: null,
      reserved: null,
    });
    expect(out.forecast).toBeNull();
    expect(out.assumption).toEqual(expect.any(String));
    expect(out.assumption.length).toBeGreaterThan(0);
  });
});
