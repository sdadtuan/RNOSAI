import { describe, expect, it } from 'vitest';
import { canOpenConfirm, canShowDangLenPage } from './cmkte-win-publish';

describe('canShowDangLenPage', () => {
  it('hides when flag off or Manual or no publish cap', () => {
    expect(canShowDangLenPage({ directSocialPublish: false, health: 'Connected', canPublish: true })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Manual', canPublish: true })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Connected', canPublish: false })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Connected', canPublish: true })).toBe(true);
  });

  it('hides when TokenExpired', () => {
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'TokenExpired', canPublish: true })).toBe(false);
  });
});

describe('canOpenConfirm', () => {
  it('is false when Blocked', () => {
    expect(canOpenConfirm('Blocked')).toBe(false);
    expect(canOpenConfirm('Pass')).toBe(true);
  });

  it('is true when Warning', () => {
    expect(canOpenConfirm('Warning')).toBe(true);
  });
});
