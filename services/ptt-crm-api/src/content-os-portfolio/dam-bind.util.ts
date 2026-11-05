import { DamInvalidResponseError, type DamRightsMetadata } from './dam-adapter';

export type DamBindBody = { dam_id: string; url: string; rights?: DamRightsMetadata | null };

export function assertBindableDamUrl(url: string, allowedHost: string): string {
  const raw = String(url ?? '').trim();
  const host = String(allowedHost ?? '').trim().toLowerCase();
  if (!raw || !host) {
    throw new DamInvalidResponseError();
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DamInvalidResponseError();
  }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== host) {
    throw new DamInvalidResponseError();
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

function sanitizeDamRightsMetadata(raw: unknown): DamRightsMetadata | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
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

export function parseDamBindBody(body: Record<string, unknown> | null | undefined): DamBindBody {
  const row = body && typeof body === 'object' ? body : {};
  const dam_id = String(row.dam_id ?? '').trim();
  const url = String(row.url ?? '').trim();
  if (!dam_id || !url) {
    throw new DamInvalidResponseError();
  }
  const parsed: DamBindBody = { dam_id, url };
  const rights = sanitizeDamRightsMetadata(row.rights);
  if (rights) parsed.rights = rights;
  return parsed;
}

export function sanitizeDamBindAuditEntity(url: string): string {
  try {
    const parsed = new URL(url);
    return `dam:${parsed.host}${parsed.pathname}`;
  } catch {
    return 'dam:invalid';
  }
}
