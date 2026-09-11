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
