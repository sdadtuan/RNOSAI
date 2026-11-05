import { describe, expect, it } from 'vitest';
import { deskPulseKey, deskPulseUnchanged } from './ae-team-pulse.util';

describe('desk pulse', () => {
  const same = {
    breaches: [{ staffId: 2, slaBreach: 1 }, { staffId: 1, slaBreach: 3 }],
    interventionIds: [9, 4],
  };

  it('keeps the numbers when the late count and the R list are unchanged', () => {
    const key = deskPulseKey(same);
    expect(deskPulseUnchanged(key, deskPulseKey({
      breaches: [{ staffId: 1, slaBreach: 3 }, { staffId: 2, slaBreach: 1 }],
      interventionIds: [4, 9],
    }))).toBe(true);
  });

  it('updates when a late count moves', () => {
    const key = deskPulseKey(same);
    expect(deskPulseUnchanged(key, deskPulseKey({
      breaches: [{ staffId: 1, slaBreach: 4 }, { staffId: 2, slaBreach: 1 }],
      interventionIds: [4, 9],
    }))).toBe(false);
    expect(deskPulseUnchanged('', key)).toBe(false);
  });
});
