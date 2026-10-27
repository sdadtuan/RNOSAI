import { isMarketingLeaderPosition } from './b2b-director.util';

describe('isMarketingLeaderPosition', () => {
  it('accepts the Marketing Leader codes', () => {
    expect(isMarketingLeaderPosition('mkl')).toBe(true);
    expect(isMarketingLeaderPosition('MKT-01')).toBe(true);
    expect(isMarketingLeaderPosition('ae')).toBe(false);
    expect(isMarketingLeaderPosition('md')).toBe(false);
  });
});
