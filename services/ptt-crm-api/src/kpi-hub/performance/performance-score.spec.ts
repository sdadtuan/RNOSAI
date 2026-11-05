import {
  healthFromDirection,
  progressPercent,
  scorecardWeightedScore,
  validateScorecardWeights,
} from './performance-score';

describe('performance-score', () => {
  it('treats CPA 149K vs 160K as green (lower-is-better)', () => {
    const progress = progressPercent({ actual: 149000, target: 160000, direction: 'lower' });
    expect(progress).toBeGreaterThan(100);
    expect(healthFromDirection({ actual: 149000, target: 160000, direction: 'lower', progress })).toBe('green');
  });

  it('marks P1 SLA 5.2h vs 4h as red', () => {
    const progress = progressPercent({ actual: 5.2, target: 4, direction: 'lower' });
    expect(healthFromDirection({ actual: 5.2, target: 4, direction: 'lower', progress })).toBe('red');
  });

  it('blocks scorecard when weights exceed 100', () => {
    expect(validateScorecardWeights([30, 20, 20, 20, 10]).valid).toBe(true);
    expect(validateScorecardWeights([30, 20, 20, 20, 15]).valid).toBe(false);
    expect(validateScorecardWeights([30, 20, 20, 20, 15]).total).toBe(105);
  });

  it('computes weighted scorecard score', () => {
    expect(
      scorecardWeightedScore([
        { score: 90, weight: 30 },
        { score: 80, weight: 70 },
      ]),
    ).toBe(83);
  });
});
