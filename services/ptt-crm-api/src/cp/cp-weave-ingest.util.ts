import { createHmac, timingSafeEqual } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import type { CpWeaveLane } from './cp-weave.types';

export type CpWeaveStoragePort = {
  list(prefix: string): Promise<string[]>;
  read(key: string): Promise<Buffer>;
};

export type CpWeaveIngestResult = {
  scanned: number;
  ingested: number;
  skipped: number;
  warnings: string[];
  assets: Array<{ id: string; lane: CpWeaveLane; checksum: string }>;
};

export function shouldIngestLane(lane: CpWeaveLane, includeDrafts: boolean): boolean {
  if (lane === 'review' || lane === 'final') return true;
  if (lane === 'drafts') return includeDrafts;
  return false;
}

export function watermarkForLane(lane: CpWeaveLane): 'DRAFT' | 'REVIEW' | null {
  if (lane === 'drafts') return 'DRAFT';
  if (lane === 'review') return 'REVIEW';
  return null;
}

export function verifyWeaveWebhookSign(
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  const key = String(secret ?? '').trim();
  const provided = String(header ?? '').trim().replace(/^sha256=/i, '');
  if (!key || !provided) return false;
  const expected = createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createDiskWeaveStorage(root: string): CpWeaveStoragePort {
  return {
    async list(prefix: string) {
      const base = join(root, prefix);
      const files: string[] = [];
      await walkDisk(base, files);
      return files.map((file) => relative(root, file).split('\\').join('/'));
    },
    async read(key: string) {
      return readFile(join(root, key));
    },
  };
}

async function walkDisk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDisk(full, out);
      continue;
    }
    if (entry.isFile()) {
      const info = await stat(full);
      if (info.isFile()) out.push(full);
    }
  }
}

export function guessMime(fileName: string): string {
  const ext = String(fileName).split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'application/octet-stream';
}
