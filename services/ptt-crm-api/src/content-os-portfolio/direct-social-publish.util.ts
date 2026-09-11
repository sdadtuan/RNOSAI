export const DIRECT_SOCIAL_PUBLISH_KEY = 'direct_social_publish';

export type CmktSettingRow = {
  key: string;
  value_json: unknown;
};

export type PublicConnectorRow = {
  id?: number;
  channel: string;
  expires_at?: string | null;
  status?: string;
};

const SECRET_KEY = /token|secret/i;

export function isMissingCmktSettingsSchema(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  if (code !== '42P01' && code !== '42703') return false;
  const message = err instanceof Error ? err.message : String((err as { message?: unknown }).message ?? '');
  const table = String((err as { table?: unknown }).table ?? '');
  const column = String((err as { column?: unknown }).column ?? '');
  return /\bcmkt_settings\b/i.test(`${message} ${table} ${column}`);
}

export function resolveDirectSocialPublish(row: CmktSettingRow | null | undefined): boolean {
  if (!row || row.key !== DIRECT_SOCIAL_PUBLISH_KEY) return false;
  return row.value_json === true;
}

export function toPublicConnectorRow(row: Record<string, unknown>): PublicConnectorRow {
  const expires = row.expires_at != null ? String(row.expires_at) : null;
  const publicRow: PublicConnectorRow = {
    channel: String(row.channel ?? ''),
  };
  if (row.id != null) publicRow.id = Number(row.id);
  if (expires) publicRow.expires_at = expires;
  if (row.status != null) publicRow.status = String(row.status);
  for (const key of Object.keys(publicRow)) {
    if (SECRET_KEY.test(key)) delete (publicRow as Record<string, unknown>)[key];
  }
  return publicRow;
}
