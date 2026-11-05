import { computeB2bAiBand, isB2bLeadInCall, resolveLeadScoreForBand } from './b2b-lead-list.util';

describe('b2b-lead-list.util', () => {
  it('maps score to ai_band', () => {
    expect(computeB2bAiBand(75)).toBe('hot');
    expect(computeB2bAiBand(50)).toBe('warm');
    expect(computeB2bAiBand(10)).toBe('cold');
  });

  it('defaults fresh Meta leads without score to hot band score', () => {
    expect(
      resolveLeadScoreForBand({
        score: null,
        status: 'moi',
        channel: 'meta',
        source: 'facebook',
      }),
    ).toBe(75);
    expect(
      resolveLeadScoreForBand({
        score: null,
        status: 'won',
        channel: 'meta',
        source: 'facebook',
      }),
    ).toBeNull();
  });

  it('in_call true when session ringing or answered', () => {
    expect(isB2bLeadInCall('ringing')).toBe(true);
    expect(isB2bLeadInCall('answered')).toBe(true);
    expect(isB2bLeadInCall('queued')).toBe(false);
    expect(isB2bLeadInCall('ended')).toBe(false);
    expect(isB2bLeadInCall(null)).toBe(false);
  });
});
