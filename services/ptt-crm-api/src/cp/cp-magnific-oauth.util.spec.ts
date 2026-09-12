import {
  createMagnificOAuthState,
  decryptProviderSecret,
  encryptProviderSecret,
  redactConnectionRow,
  verifyMagnificOAuthState,
} from './cp-magnific-oauth.util';

const ENCRYPT_KEY = 'a'.repeat(32);

describe('cp-magnific-oauth.util', () => {
  const envBackup = process.env;

  beforeEach(() => {
    process.env = { ...envBackup, PTT_SECRET_ENCRYPT_KEY: ENCRYPT_KEY };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('round-trips a signed oauth state', () => {
    const created = createMagnificOAuthState({ staffId: 9, ttlSec: 120 });
    expect(created.state).toEqual(expect.any(String));
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(verifyMagnificOAuthState(created.state).staffId).toBe(9);
  });

  it('throws on a bad oauth state', () => {
    expect(() => verifyMagnificOAuthState('not-a-valid-state')).toThrow();
    const { state } = createMagnificOAuthState({ staffId: 9 });
    expect(() => verifyMagnificOAuthState(`${state}tampered`)).toThrow();
  });

  it('throws on an expired oauth state', () => {
    const { state } = createMagnificOAuthState({ staffId: 9, ttlSec: 1 });
    expect(() => verifyMagnificOAuthState(state, new Date(Date.now() + 5_000))).toThrow();
  });

  it('round-trips an encrypted provider secret', () => {
    const cipher = encryptProviderSecret('tok_live');
    expect(cipher).not.toContain('tok_live');
    expect(decryptProviderSecret(cipher)).toBe('tok_live');
  });

  it('strips secrets from a connection row', () => {
    const redacted = redactConnectionRow({
      id: '11111111-1111-4111-8111-111111111111',
      provider: 'magnific_mcp',
      status: 'on',
      account_label: 'PTT ops',
      expires_at: '2026-09-13T00:00:00.000Z',
      secret_ref: 'enc:should-not-leak',
      access_token: 'tok_live',
      refresh_token: 'ref_live',
      api_key: 'sk-live',
    });

    expect(redacted).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      provider: 'magnific_mcp',
      status: 'on',
      account_label: 'PTT ops',
      expires_at: '2026-09-13T00:00:00.000Z',
      has_secret: true,
    });
    expect(redacted).not.toHaveProperty('secret_ref');
    expect(redacted).not.toHaveProperty('access_token');
    expect(redacted).not.toHaveProperty('refresh_token');
    expect(redacted).not.toHaveProperty('api_key');
  });
});
