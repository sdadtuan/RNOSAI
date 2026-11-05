import {
  DamInvalidResponseError,
  DamNotConfiguredError,
  sanitizeDamDiagnostic,
  toDamUrlMetadata,
  type DamAdapter,
  type DamUrlMetadata,
} from './dam-adapter';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 512_000;
const MAX_REDIRECTS = 5;

type DamFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status?: number;
  headers?: { get: (name: string) => string | null };
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}>;

export function assertDamBaseUrl(raw: string | undefined): URL {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    throw new DamNotConfiguredError();
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DamNotConfiguredError();
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) {
    throw new DamNotConfiguredError();
  }
  return parsed;
}

export function createHttpJsonDamAdapter(opts: {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}): DamAdapter {
  const base = assertDamBaseUrl(opts.baseUrl);
  const allowedHost = base.hostname.toLowerCase();
  const fetchFn = (opts.fetchFn ?? fetch) as DamFetchFn;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const baseHref = base.href.replace(/\/$/, '');

  return {
    async list(query): Promise<DamUrlMetadata[]> {
      const collection = String(query.collection ?? '').trim();
      if (!collection) {
        throw new DamInvalidResponseError();
      }
      const raw = await fetchDamJson({
        url: `${baseHref}/${encodeURIComponent(collection)}`,
        allowedHost,
        fetchFn,
        timeoutMs,
        maxBytes,
      });
      if (!Array.isArray(raw)) {
        throw new DamInvalidResponseError();
      }
      const items: DamUrlMetadata[] = [];
      for (const row of raw) {
        const item = toDamUrlMetadata(row);
        if (!item || !isAllowlistedHttpsUrl(item.url, allowedHost)) {
          throw new DamInvalidResponseError();
        }
        items.push(item);
      }
      return items;
    },
  };
}

function isAllowlistedHttpsUrl(raw: string, allowedHost: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === allowedHost;
  } catch {
    return false;
  }
}

function isRedirectStatus(status: number | undefined): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchDamJson(opts: {
  url: string;
  allowedHost: string;
  fetchFn: DamFetchFn;
  timeoutMs: number;
  maxBytes: number;
}): Promise<unknown> {
  let nextUrl = opts.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowlistedHttpsUrl(nextUrl, opts.allowedHost)) {
        throw new DamInvalidResponseError();
      }
      const res = await opts.fetchFn(nextUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
      if (isRedirectStatus(res.status)) {
        const location = res.headers?.get('location');
        if (!location) {
          throw new DamInvalidResponseError();
        }
        nextUrl = new URL(location, nextUrl).toString();
        continue;
      }
      if (!res.ok) {
        throw new Error(sanitizeDamDiagnostic(`dam http ${res.status ?? 'error'}`));
      }
      return readJsonCapped(res, opts.maxBytes);
    }
    throw new DamInvalidResponseError();
  } catch (err) {
    if (err instanceof DamInvalidResponseError || err instanceof DamNotConfiguredError) {
      throw err;
    }
    throw new Error(sanitizeDamDiagnostic(err));
  }
}

async function readJsonCapped(
  res: {
    headers?: { get: (name: string) => string | null };
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  },
  maxBytes: number,
): Promise<unknown> {
  const len = Number(res.headers?.get('content-length'));
  if (Number.isFinite(len) && len > maxBytes) {
    throw new DamInvalidResponseError();
  }
  if (typeof res.text === 'function') {
    const text = await res.text();
    if (text.length > maxBytes) {
      throw new DamInvalidResponseError();
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DamInvalidResponseError();
    }
  }
  if (typeof res.json === 'function') {
    return res.json();
  }
  throw new DamInvalidResponseError();
}
