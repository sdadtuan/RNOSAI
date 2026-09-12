import { createHmac, timingSafeEqual } from 'crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import sharp from 'sharp';
import type { CpWeaveLane } from './cp-weave.types';

export type CpWeaveStoragePort = {
  list(prefix: string): Promise<string[]>;
  read(key: string): Promise<Buffer>;
  write?(key: string, data: Buffer): Promise<void>;
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
    async write(key: string, data: Buffer) {
      const dest = join(root, key);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, data);
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

export function durationMsFromProbe(facts: { duration_sec?: number | null }): number | null {
  const sec = Number(facts.duration_sec);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return Math.round(sec * 1000);
}

export async function applyWeaveWatermark(
  bytes: Buffer,
  label: 'DRAFT' | 'REVIEW' | null,
): Promise<{
  proxy: Buffer;
  thumb: Buffer;
  width: number | null;
  height: number | null;
  watermarked: boolean;
}> {
  try {
    const meta = await sharp(bytes, { failOn: 'none' }).metadata();
    const width = meta.width && meta.width > 0 ? meta.width : null;
    const height = meta.height && meta.height > 0 ? meta.height : null;
    const overlayW = width ?? 320;
    const overlayH = Math.max(28, Math.round((height ?? 180) * 0.12));
    let pipeline = sharp(bytes, { failOn: 'none' });
    if (label) {
      const svg = Buffer.from(
        `<svg width="${overlayW}" height="${overlayH}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)"/>
          <text x="50%" y="70%" text-anchor="middle" font-size="${Math.max(14, Math.round(overlayH * 0.5))}"
                fill="#fff" font-family="Arial, sans-serif" font-weight="700">${label}</text>
        </svg>`,
      );
      pipeline = pipeline.composite([{ input: svg, gravity: 'southeast' }]);
    }
    const proxy = await pipeline.jpeg({ quality: 85 }).toBuffer();
    const thumb = await sharp(proxy).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    return { proxy, thumb, width, height, watermarked: Boolean(label) };
  } catch {
    if (!label) {
      const thumb = await sharp({
        create: { width: 320, height: 180, channels: 3, background: { r: 30, g: 30, b: 30 } },
      }).jpeg({ quality: 80 }).toBuffer().catch(() => bytes);
      return { proxy: bytes, thumb, width: null, height: null, watermarked: false };
    }
    const svg = Buffer.from(
      `<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#111"/>
        <text x="50%" y="54%" text-anchor="middle" font-size="36" fill="#fff"
              font-family="Arial, sans-serif" font-weight="700">${label}</text>
      </svg>`,
    );
    const thumb = await sharp(svg).jpeg({ quality: 80 }).toBuffer();
    return { proxy: thumb, thumb, width: 320, height: 180, watermarked: true };
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
