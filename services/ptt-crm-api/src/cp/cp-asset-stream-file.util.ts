import * as fs from 'fs';
import { StreamableFile, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { parseByteRange } from './cp-asset-byte-range.util';
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
  size: number;
  length: number;
  status: 200 | 206;
  contentRange?: string;
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
  rangeHeader?: string,
): OpenedAssetStream | null {
  const resolved = resolveReadableWeaveFile(key, mimeHint);
  if (!resolved) return null;
  const size = fs.statSync(resolved.abs).size;
  const range = parseByteRange(rangeHeader, size);
  if (range === 'unsatisfiable') return null;
  return {
    file: new StreamableFile(fs.createReadStream(resolved.abs, {
      start: range.start,
      end: range.end,
    })),
    mime: resolved.mime,
    filename: resolved.filename,
    size,
    length: range.end - range.start + 1,
    status: range.status,
    contentRange: range.status === 206
      ? `bytes ${range.start}-${range.end}/${size}`
      : undefined,
  };
}

export function applyAssetStreamHeaders(res: Response, out: OpenedAssetStream): void {
  const safeName = out.filename.replace(/["\r\n]+/g, '_');
  res.status(out.status);
  res.setHeader('Content-Type', out.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', String(out.length));
  if (out.contentRange) res.setHeader('Content-Range', out.contentRange);
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
