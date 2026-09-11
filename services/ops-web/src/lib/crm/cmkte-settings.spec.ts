import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIRECT_SOCIAL_PUBLISH,
  DEFAULT_SSO_ENFORCED,
  readDirectSocialPublish,
  readSsoEnforced,
  ssoEnforcedControl,
  stripConnectorSecrets,
} from './cmkte-settings';

describe('cmkte-settings', () => {
  it('exposes sso_enforced read-only false when no IdP is configured', () => {
    expect(DEFAULT_SSO_ENFORCED).toBe(false);
    expect(readSsoEnforced(undefined)).toBe(false);
    expect(readSsoEnforced(null)).toBe(false);
    expect(readSsoEnforced({})).toBe(false);
    expect(readSsoEnforced({ sso_enforced: false })).toBe(false);
    expect(ssoEnforcedControl(false)).toEqual({ checked: false, disabled: true, readOnly: true });
  });

  it('exposes sso_enforced read-only true when staff IdP is enforced', () => {
    expect(readSsoEnforced({ sso_enforced: true })).toBe(true);
    expect(ssoEnforcedControl(true)).toEqual({ checked: true, disabled: true, readOnly: true });
  });

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
