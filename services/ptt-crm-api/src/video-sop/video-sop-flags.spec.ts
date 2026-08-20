import { assertCinematicEnabled } from './video-sop-flags';

describe('video-sop-flags', () => {
  it('throws cmkt_cinematic_disabled when flag off', () => {
    expect(() =>
      assertCinematicEnabled({ contentMarketingVideoCinematicEnabled: false }),
    ).toThrow(/cmkt_cinematic_disabled/);
  });

  it('passes when flag on', () => {
    expect(() =>
      assertCinematicEnabled({ contentMarketingVideoCinematicEnabled: true }),
    ).not.toThrow();
  });
});
