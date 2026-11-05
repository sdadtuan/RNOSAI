export const DEFAULT_DIRECT_SOCIAL_PUBLISH = false;
export const DEFAULT_SSO_ENFORCED = false;
export const SSO_ENFORCED_LABEL = 'SSO enforced (read-only · Staff SSO)';
export const AUDIT_RETENTION_YEARS = 7;
export const AUDIT_RETENTION_COPY = 'Audit lưu 7 năm.';
export const AUDIT_EXPORT_EMPTY_TOAST = 'Không có dòng audit để xuất.';
export const AUDIT_EXPORT_ERROR_TOAST = 'Không xuất được audit.';

export function isAuditExportEmpty(csv: string): boolean {
  return csv.split(/\r?\n/).filter((line) => line.trim().length > 0).length <= 1;
}

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
