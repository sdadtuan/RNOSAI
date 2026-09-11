/** Content OS does not own an IdP. Staff SSO is the identity hook. */
export const SSO_ENFORCED_KEY = 'sso_enforced';

/**
 * Settings `sso_enforced` is read-only in E3.
 * False when no IdP is configured. Content OS never persists or enforces this flag;
 * Staff SSO (Keycloak) remains the identity path. SCIM is out of scope here.
 */
export function resolveSsoEnforced(input?: { idpConfigured?: boolean } | null): boolean {
  if (input?.idpConfigured !== true) return false;
  return false;
}
