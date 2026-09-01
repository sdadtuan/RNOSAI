import { StaffAccountRateLimiter } from './staff-account-rate.util';

describe('StaffAccountRateLimiter', () => {
  it('allows 5 password hits then blocks', () => {
    const lim = new StaffAccountRateLimiter();
    for (let i = 0; i < 5; i++) expect(lim.hit('password', 'u1', 15 * 60_000, 5)).toBe(true);
    expect(lim.hit('password', 'u1', 15 * 60_000, 5)).toBe(false);
    expect(lim.hit('password', 'u2', 15 * 60_000, 5)).toBe(true);
  });

  it('allows 10 avatar hits', () => {
    const lim = new StaffAccountRateLimiter();
    for (let i = 0; i < 10; i++) expect(lim.hit('avatar', 'u1', 15 * 60_000, 10)).toBe(true);
    expect(lim.hit('avatar', 'u1', 15 * 60_000, 10)).toBe(false);
  });
});
