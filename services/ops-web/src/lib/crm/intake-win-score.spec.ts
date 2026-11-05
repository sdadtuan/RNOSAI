import { describe, expect, it } from 'vitest';
import { computeWinTotal, WIN_SCORE_KEYS } from './intake-win-score';

describe('intake-win-score', () => {
  it('sums only WIN_SCORE_KEYS within 1–5', () => {
    expect(
      computeWinTotal({
        incumbent: 4,
        competitor: 4,
        selection_criteria: 4,
        switch_risk: 3,
        champion: 2,
        next_step: 1,
      }),
    ).toBe(18);
  });

  it('ignores keys outside WIN_SCORE_KEYS', () => {
    expect(computeWinTotal({ incumbent: 3, junk: 99 })).toBe(3);
    expect(WIN_SCORE_KEYS).toHaveLength(6);
  });

  it('treats scores outside 1–5 as 0', () => {
    expect(computeWinTotal({ incumbent: 0, competitor: 6, selection_criteria: -1 })).toBe(0);
  });
});
