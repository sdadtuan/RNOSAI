export const DEFAULT_DIRECT_SOCIAL_PUBLISH = false;
export const DEFAULT_SSO_ENFORCED = false;
export const SSO_ENFORCED_LABEL = 'SSO enforced (read-only · Staff SSO)';

const SECRET_KEY = /token|secret/i;

export function readDirectSocialPublish(
  settings: { direct_social_publish?: unknown } | null | undefined,
): boolean {
  return settings?.direct_social_publish === true;
}

/** E3: read-only API boolean. Missing / no IdP → false. Staff IdP-enforced → true. */
export function readSsoEnforced(
  settings: { sso_enforced?: unknown } | null | undefined,
): boolean {
  return settings?.sso_enforced === true;
}

export function ssoEnforcedControl(value: boolean | undefined = DEFAULT_SSO_ENFORCED): {
  checked: boolean;
  disabled: true;
  readOnly: true;
} {
  return { checked: value === true, disabled: true, readOnly: true };
}

export function stripConnectorSecrets(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = value;
  }
  return out;
}
