export const DEFAULT_DIRECT_SOCIAL_PUBLISH = false;

const SECRET_KEY = /token|secret/i;

export function readDirectSocialPublish(
  settings: { direct_social_publish?: unknown } | null | undefined,
): boolean {
  return settings?.direct_social_publish === true;
}

export function stripConnectorSecrets(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = value;
  }
  return out;
}
