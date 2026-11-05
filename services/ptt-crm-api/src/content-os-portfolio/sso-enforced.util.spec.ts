import { resolveSsoEnforced } from './sso-enforced.util';

describe('resolveSsoEnforced', () => {
  it('is false when no IdP / local staff auth', () => {
    expect(resolveSsoEnforced()).toBe(false);
    expect(resolveSsoEnforced(null)).toBe(false);
    expect(resolveSsoEnforced(undefined)).toBe(false);
    expect(resolveSsoEnforced({ staffAuthMode: 'nest' })).toBe(false);
    expect(resolveSsoEnforced({ staffAuthMode: 'nest', staffKeycloakIssuer: null })).toBe(false);
    expect(
      resolveSsoEnforced({
        staffAuthMode: 'dual',
        staffKeycloakIssuer: 'http://127.0.0.1:8080/realms/ptt-staff',
      }),
    ).toBe(false);
    expect(resolveSsoEnforced({ staffAuthMode: 'keycloak', staffKeycloakIssuer: '' })).toBe(false);
    expect(resolveSsoEnforced({ staffAuthMode: 'keycloak', staffKeycloakIssuer: null })).toBe(false);
    expect(resolveSsoEnforced({ idpConfigured: true })).toBe(false);
  });

  it('is true only when staff login is IdP-enforced (keycloak mode + issuer)', () => {
    expect(
      resolveSsoEnforced({
        staffAuthMode: 'keycloak',
        staffKeycloakIssuer: 'http://127.0.0.1:8080/realms/ptt-staff',
      }),
    ).toBe(true);
  });
});
