export const DAM_PICK_LABEL = 'Chọn từ DAM';

const SECRET_KEY = /token|secret/i;

export type DamRightsMetadata = {
  status?: string;
  license_type?: string | null;
  channels?: string[];
  territory?: string | null;
  expiry_at?: string | null;
};

export type DamUrlMetadata = {
  id: string;
  url: string;
  collection?: string;
  filename?: string;
  mime_type?: string;
  rights?: DamRightsMetadata | null;
};

export type DamListResult = {
  items: DamUrlMetadata[];
  error?: string;
};

export const DAM_PUBLIC_ERROR_CODES = [
  'dam_not_configured',
  'dam_unavailable',
  'dam_invalid_response',
] as const;

export type DamPublicError = (typeof DAM_PUBLIC_ERROR_CODES)[number];

function isDamPublicError(value: string): value is DamPublicError {
  return (DAM_PUBLIC_ERROR_CODES as readonly string[]).includes(value);
}

function toDamPublicError(value: string | undefined, fallback?: string): DamPublicError {
  const trimmed = value?.trim() ?? '';
  if (isDamPublicError(trimmed)) return trimmed;
  const fallbackTrimmed = fallback?.trim() ?? '';
  if (isDamPublicError(fallbackTrimmed)) return fallbackTrimmed;
  return 'dam_unavailable';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toOptionalRights(raw: unknown): DamRightsMetadata | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const rights: DamRightsMetadata = {};
  if (row.status != null) rights.status = String(row.status);
  if (row.license_type != null) rights.license_type = String(row.license_type).trim() || null;
  if (Array.isArray(row.channels)) {
    rights.channels = row.channels.map((ch) => String(ch).trim()).filter(Boolean);
  }
  if (row.territory != null) rights.territory = String(row.territory).trim() || null;
  if (row.expiry_at != null) rights.expiry_at = String(row.expiry_at).trim() || null;
  return Object.keys(rights).length ? rights : undefined;
}

export function toDamUrlMetadata(raw: unknown): DamUrlMetadata | null {
  const row = asRecord(raw);
  if (!row) return null;
  const url = String(row.url ?? '').trim();
  if (!url) return null;
  const id = String(row.id ?? '').trim() || url;
  const item: DamUrlMetadata = { id, url };
  const collection = String(row.collection ?? '').trim();
  if (collection) item.collection = collection;
  const filename = String(row.filename ?? '').trim();
  if (filename) item.filename = filename;
  const mime = String(row.mime_type ?? '').trim();
  if (mime) item.mime_type = mime;
  const rights = toOptionalRights(row.rights);
  if (rights) item.rights = rights;
  for (const key of Object.keys(item)) {
    if (SECRET_KEY.test(key)) delete (item as Record<string, unknown>)[key];
  }
  return item;
}

export function readDamListResult(body: unknown, fallbackError?: string): DamListResult {
  const row = asRecord(body);
  const errorRaw = row && typeof row.error === 'string' ? row.error.trim() : '';
  if (errorRaw || fallbackError) {
    return { items: [], error: toDamPublicError(errorRaw, fallbackError) };
  }
  if (!Array.isArray(row?.items)) {
    return { items: [], error: 'dam_invalid_response' };
  }
  const items = row.items.map(toDamUrlMetadata).filter((item): item is DamUrlMetadata => item != null);
  return { items };
}
