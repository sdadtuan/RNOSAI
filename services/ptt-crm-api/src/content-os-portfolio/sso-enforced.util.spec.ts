import { resolveSsoEnforced } from './sso-enforced.util';

describe('resolveSsoEnforced', () => {
  it('is false when no IdP is configured', () => {
    expect(resolveSsoEnforced()).toBe(false);
    expect(resolveSsoEnforced(null)).toBe(false);
    expect(resolveSsoEnforced(undefined)).toBe(false);
    expect(resolveSsoEnforced({ idpConfigured: false })).toBe(false);
    expect(resolveSsoEnforced({ idpConfigured: undefined })).toBe(false);
  });

  it('stays false in E3 even if Staff SSO IdP exists — Content OS does not enforce SSO', () => {
    expect(resolveSsoEnforced({ idpConfigured: true })).toBe(false);
  });
});
