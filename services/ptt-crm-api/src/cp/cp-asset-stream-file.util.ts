import * as fs from 'fs';
import { StreamableFile, UnauthorizedException } from '@nestjs/common';
import {
  assetStreamSecret,
  verifyAssetStream,
  type AssetStreamResource,
} from './cp-asset-signed-url.util';
import { resolveWeaveStreamAbs, weaveExportPrefix } from './cp-weave-stream-path.util';
import { guessMime } from './cp-weave-ingest.util';

export type OpenedAssetStream = {
  file: StreamableFile;
  mime: string;
  filename: string;
};

export function resolveReadableWeaveFile(
  key: string,
  mimeHint?: string | null,
): { abs: string; mime: string; filename: string } | null {
  const prefix = weaveExportPrefix();
  if (!prefix) return null;
  const abs = resolveWeaveStreamAbs(prefix, key);
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  const filename = abs.split(/[\\/]/).pop() || 'asset';
  return {
    abs,
    filename,
    mime: mimeHint?.trim() || guessMime(filename),
  };
}

export function openReadableWeaveFile(
  key: string,
  mimeHint?: string | null,
): OpenedAssetStream | null {
  const resolved = resolveReadableWeaveFile(key, mimeHint);
  if (!resolved) return null;
  return {
    file: new StreamableFile(fs.createReadStream(resolved.abs)),
    mime: resolved.mime,
    filename: resolved.filename,
  };
}

export function assertAssetStreamSig(
  resource: AssetStreamResource,
  id: string,
  exp: string | undefined,
  sig: string | undefined,
): void {
  const result = verifyAssetStream({
    resource,
    id,
    exp: exp ?? '',
    sig: sig ?? '',
    secret: assetStreamSecret(),
  });
  if (result === 'ok') return;
  throw new UnauthorizedException({
    error: result === 'expired' ? 'signed_url_expired' : 'signed_url_invalid',
  });
}
