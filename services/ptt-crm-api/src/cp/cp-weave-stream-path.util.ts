import * as path from 'path';
import { parseWeaveExportKey } from './cp-weave-path.util';

const STREAM_LANES = new Set(['review', 'final']);

export function weaveExportPrefix(env: NodeJS.ProcessEnv = process.env): string | null {
  const prefix = String(env.WEAVE_EXPORT_PREFIX ?? '').trim();
  return prefix || null;
}

export function resolveWeaveStreamAbs(prefix: string, key: string): string | null {
  const root = String(prefix ?? '').trim();
  if (!root) return null;
  const parsed = parseWeaveExportKey(key);
  if (!parsed || !STREAM_LANES.has(parsed.lane)) return null;
  if (parsed.fileName.includes('..') || parsed.fileName.includes('/') || parsed.fileName.includes('\\')) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const abs = path.resolve(
    resolvedRoot,
    parsed.clientCode,
    parsed.campaignCode,
    parsed.taskId,
    parsed.lane,
    parsed.fileName,
  );
  const relative = path.relative(resolvedRoot, abs);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return abs;
}
