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

const SECRET_KEY = /token|secret/i;

export class DamNotConfiguredError extends Error {
  constructor(message = 'dam_not_configured') {
    super(message);
    this.name = 'DamNotConfiguredError';
  }
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
      const rows = Array.isArray(raw) ? raw : [];
      return rows.map(toDamUrlMetadata).filter((row): row is DamUrlMetadata => row != null);
    },
  };
}

export async function listDamOrEmpty(
  adapter: DamAdapter,
  query: DamListQuery = {},
): Promise<DamListResult> {
  try {
    const items = await adapter.list(query);
    return { items };
  } catch (err) {
    const error = err instanceof Error && err.message.trim() ? err.message : 'dam_list_failed';
    return { items: [], error };
  }
}
