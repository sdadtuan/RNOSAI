import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIRECT_SOCIAL_PUBLISH,
  readDirectSocialPublish,
  stripConnectorSecrets,
} from './cmkte-settings';

describe('cmkte-settings', () => {
  it('defaults the direct social publish switch to false', () => {
    expect(DEFAULT_DIRECT_SOCIAL_PUBLISH).toBe(false);
    expect(readDirectSocialPublish(undefined)).toBe(false);
    expect(readDirectSocialPublish(null)).toBe(false);
    expect(readDirectSocialPublish({})).toBe(false);
  });

  it('reads the stored switch without inventing true', () => {
    expect(readDirectSocialPublish({ direct_social_publish: true })).toBe(true);
    expect(readDirectSocialPublish({ direct_social_publish: false })).toBe(false);
  });

  it('strips token and secret fields before browser JSON', () => {
    const publicRow = stripConnectorSecrets({
      channel: 'facebook',
      expires_at: '2026-12-01T00:00:00.000Z',
      access_token: 'EAABsecret',
      refresh_token: 'refresh-secret',
      secret_json: { app_secret: 'nope' },
    });
    expect(publicRow).toEqual({
      channel: 'facebook',
      expires_at: '2026-12-01T00:00:00.000Z',
    });
    expect(JSON.stringify(publicRow)).not.toMatch(/token|secret|EAABsecret|nope/i);
  });
});
