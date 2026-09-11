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

export function parseDamBindBody(body: Record<string, unknown> | null | undefined): DamBindBody {
  const row = body && typeof body === 'object' ? body : {};
  const dam_id = String(row.dam_id ?? '').trim();
  const url = String(row.url ?? '').trim();
  if (!dam_id || !url) {
    throw new DamInvalidResponseError();
  }
  const parsed: DamBindBody = { dam_id, url };
  if (row.rights != null && typeof row.rights === 'object' && !Array.isArray(row.rights)) {
    parsed.rights = row.rights as DamRightsMetadata;
  }
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
