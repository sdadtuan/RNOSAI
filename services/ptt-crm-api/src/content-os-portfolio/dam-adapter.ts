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

export type DamListQuery = { collection?: string };

export type DamListResult = {
  items: DamUrlMetadata[];
  error?: string;
};

export type DamAdapter = {
  list(query: DamListQuery): Promise<DamUrlMetadata[]>;
};

export const DAM_PUBLIC_ERROR_CODES = [
  'dam_not_configured',
  'dam_unavailable',
  'dam_invalid_response',
] as const;

export type DamPublicError = (typeof DAM_PUBLIC_ERROR_CODES)[number];

const SECRET_KEY = /token|secret/i;
const SECRET_PAIR = /\b(?:access_)?(?:token|secret|signature|sig|key)\s*[:=]\s*\S+/gi;
const SIGNED_QUERY = /[?&](?:X-Amz-[^=]+|signature|token|sig)=[^&\s]*/gi;

export class DamNotConfiguredError extends Error {
  constructor(message = 'dam_not_configured') {
    super(message);
    this.name = 'DamNotConfiguredError';
  }
}

export class DamInvalidResponseError extends Error {
  constructor(message = 'dam_invalid_response') {
    super(message);
    this.name = 'DamInvalidResponseError';
  }
}

export function isDamPublicError(value: string): value is DamPublicError {
  return (DAM_PUBLIC_ERROR_CODES as readonly string[]).includes(value);
}

export function toDamPublicError(err: unknown): DamPublicError {
  if (err instanceof DamNotConfiguredError) return 'dam_not_configured';
  if (err instanceof DamInvalidResponseError) return 'dam_invalid_response';
  if (err instanceof Error && isDamPublicError(err.message.trim())) return err.message.trim() as DamPublicError;
  return 'dam_unavailable';
}

export function sanitizeDamDiagnostic(value: unknown): string {
  const raw = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? 'unknown');
  return raw
    .replace(SIGNED_QUERY, '[redacted]')
    .replace(SECRET_PAIR, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .slice(0, 240);
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

export function stubDamAdapter(opts?: {
  fetchList?: (query: DamListQuery) => Promise<unknown>;
}): DamAdapter {
  return {
    async list(query: DamListQuery): Promise<DamUrlMetadata[]> {
      if (!opts?.fetchList) {
        throw new DamNotConfiguredError();
      }
      const raw = await opts.fetchList(query);
      if (!Array.isArray(raw)) {
        throw new DamInvalidResponseError();
      }
      return raw.map(toDamUrlMetadata).filter((row): row is DamUrlMetadata => row != null);
    },
  };
}

export async function listDamOrEmpty(
  adapter: DamAdapter,
  query: DamListQuery = {},
  opts?: { log?: (message: string) => void },
): Promise<DamListResult> {
  const log = opts?.log ?? ((message: string) => console.warn(`[dam] ${message}`));
  try {
    const items = await adapter.list(query);
    if (!Array.isArray(items)) {
      const error: DamPublicError = 'dam_invalid_response';
      log(`${error} ${sanitizeDamDiagnostic('non-array list payload')}`);
      return { items: [], error };
    }
    return { items };
  } catch (err) {
    const error = toDamPublicError(err);
    log(`${error} ${sanitizeDamDiagnostic(err)}`);
    return { items: [], error };
  }
}
