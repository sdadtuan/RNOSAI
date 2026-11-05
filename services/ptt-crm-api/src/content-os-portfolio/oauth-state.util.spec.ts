import { createOauthState, isOauthStateExpired } from './oauth-state.util';

describe('oauth state', () => {
  it('is long and expires after TTL', () => {
    expect(createOauthState().length).toBeGreaterThanOrEqual(24);
    const exp = new Date('2026-09-11T10:10:00.000Z');
    expect(isOauthStateExpired(exp, new Date('2026-09-11T10:11:00.000Z'))).toBe(true);
    expect(isOauthStateExpired(exp, new Date('2026-09-11T10:09:00.000Z'))).toBe(false);
  });
});
