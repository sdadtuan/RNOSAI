import {
  DIRECT_SOCIAL_PUBLISH_KEY,
  isMissingCmktSettingsSchema,
  resolveDirectSocialPublish,
  toPublicConnectorRow,
} from './direct-social-publish.util';

describe('resolveDirectSocialPublish', () => {
  it('defaults false when the settings row is missing', () => {
    expect(resolveDirectSocialPublish(null)).toBe(false);
    expect(resolveDirectSocialPublish(undefined)).toBe(false);
  });

  it('reads the stored boolean for direct_social_publish', () => {
    expect(resolveDirectSocialPublish({ key: DIRECT_SOCIAL_PUBLISH_KEY, value_json: true })).toBe(true);
    expect(resolveDirectSocialPublish({ key: DIRECT_SOCIAL_PUBLISH_KEY, value_json: false })).toBe(false);
  });

  it('treats a non-true stored value as false', () => {
    expect(resolveDirectSocialPublish({ key: DIRECT_SOCIAL_PUBLISH_KEY, value_json: 'true' })).toBe(false);
    expect(resolveDirectSocialPublish({ key: 'other', value_json: true })).toBe(false);
  });
});

describe('isMissingCmktSettingsSchema', () => {
  it('accepts 42P01/42703 only when the error mentions cmkt_settings', () => {
    expect(
      isMissingCmktSettingsSchema(
        Object.assign(new Error('relation "cmkt_settings" does not exist'), { code: '42P01' }),
      ),
    ).toBe(true);
    expect(
      isMissingCmktSettingsSchema(
        Object.assign(new Error('column "value_json" does not exist'), {
          code: '42703',
          table: 'cmkt_settings',
        }),
      ),
    ).toBe(true);
    expect(
      isMissingCmktSettingsSchema(
        Object.assign(new Error('relation "cmkt_connectors" does not exist'), { code: '42P01' }),
      ),
    ).toBe(false);
    expect(
      isMissingCmktSettingsSchema(Object.assign(new Error('too many connections'), { code: '53300' })),
    ).toBe(false);
  });
});

describe('toPublicConnectorRow', () => {
  it('never serializes token or secret columns', () => {
    const publicRow = toPublicConnectorRow({
      id: 3,
      channel: 'facebook',
      expires_at: '2026-12-01T00:00:00.000Z',
      status: 'off',
      access_token: 'EAABsecret',
      refresh_token: 'refresh-secret',
      secret_json: { app_secret: 'nope' },
    });
    expect(publicRow).toEqual({
      id: 3,
      channel: 'facebook',
      expires_at: '2026-12-01T00:00:00.000Z',
      status: 'off',
    });
    expect(JSON.stringify(publicRow)).not.toMatch(/token|secret|EAABsecret|refresh-secret|app_secret/i);
  });
});
