import * as crypto from 'crypto';

export type AssetStreamResource = 'cp_asset' | 'creative';
export type AssetStreamVerifyResult = 'ok' | 'expired' | 'invalid';

const DEFAULT_TTL_SEC = 15 * 60;

export function assetStreamSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.PTT_ASSET_STREAM_SECRET
    || env.PTT_PORTAL_JWT_SECRET
    || env.PTT_CRM_INTERNAL_KEY
    || 'dev-portal-jwt-change-me'
  ).trim();
}

export function assetStreamTtlSec(env: NodeJS.ProcessEnv = process.env): number {
  const minutes = Number(env.PTT_ASSET_STREAM_TTL_MIN ?? 15);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 15;
  return Math.max(60, Math.round(safeMinutes * 60));
}

export function signAssetStream(input: {
  resource: AssetStreamResource;
  id: string;
  exp: number;
  secret: string;
}): string {
  const data = `${input.resource}.${input.id}.${input.exp}`;
  return crypto.createHmac('sha256', input.secret).update(data).digest('base64url');
}

export function verifyAssetStream(input: {
  resource: AssetStreamResource;
  id: string;
  exp: number | string;
  sig: string;
  secret: string;
  nowSec?: number;
}): AssetStreamVerifyResult {
  const exp = Number(input.exp);
  const sig = String(input.sig ?? '');
  if (!Number.isFinite(exp) || exp <= 0 || !sig) return 'invalid';
  const expected = signAssetStream({
    resource: input.resource,
    id: input.id,
    exp,
    secret: input.secret,
  });
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return 'invalid';
  }
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (exp < now) return 'expired';
  return 'ok';
}

export function mintAssetStreamQuery(input: {
  resource: AssetStreamResource;
  id: string;
  secret: string;
  nowSec?: number;
  ttlSec?: number;
}): { exp: number; sig: string } {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, input.ttlSec ?? DEFAULT_TTL_SEC);
  const exp = now + ttl;
  return {
    exp,
    sig: signAssetStream({
      resource: input.resource,
      id: input.id,
      exp,
      secret: input.secret,
    }),
  };
}

export function isHttpAssetUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

export function buildAssetStreamPath(basePath: string, exp: number, sig: string): string {
  const qs = new URLSearchParams({ exp: String(exp), sig });
  return `${basePath}?${qs.toString()}`;
}
