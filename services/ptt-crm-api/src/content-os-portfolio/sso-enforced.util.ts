/** Content OS does not own an IdP. Staff SSO is the identity hook. */
export const SSO_ENFORCED_KEY = 'sso_enforced';

export type StaffIdpSnapshot = {
  staffAuthMode?: string | null;
  staffKeycloakIssuer?: string | null;
  idpConfigured?: boolean;
};

/**
 * Settings `sso_enforced` is read-only in E3.
 * True only when staff login is IdP-enforced: `STAFF_AUTH_MODE=keycloak`
 * and `PTT_STAFF_KEYCLOAK_ISSUER` is present. False for nest/dual or missing issuer.
 * Never persist this flag. Do not put IdP secrets in GET JSON.
 */
export function resolveSsoEnforced(input?: StaffIdpSnapshot | null): boolean {
  const mode = String(input?.staffAuthMode ?? '').trim().toLowerCase();
  const issuer = String(input?.staffKeycloakIssuer ?? '').trim();
  return mode === 'keycloak' && issuer.length > 0;
}
