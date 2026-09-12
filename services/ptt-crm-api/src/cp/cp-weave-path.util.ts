import type { CpWeaveLane } from './cp-weave.types';

const LANES = new Set<CpWeaveLane>(['source', 'drafts', 'review', 'approved', 'final']);
const RATIOS = new Set(['1x1', '9x16', '16x9', '4x5', 'og']);
const CODE_RE = /^[a-z0-9-]+$/;
const TASK_RE = /^CR-\d{4}-\d{4}-\d{3}$/;
const FILE_RE = /^(CR-\d{4}-\d{4}-\d{3})_v(\d{2})_([0-9a-z]+)\.([A-Za-z0-9]+)$/;

export function buildWeaveExportRelPath(input: {
  clientCode: string;
  campaignCode: string;
  taskId: string;
  lane: CpWeaveLane;
}): string {
  return `${input.clientCode}/${input.campaignCode}/${input.taskId}/${input.lane}/`;
}

export function parseWeaveExportKey(key: string): {
  clientCode: string;
  campaignCode: string;
  taskId: string;
  lane: CpWeaveLane;
  fileName: string;
} | null {
  const trimmed = String(key ?? '').trim().replace(/^\/+/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 5) return null;
  const [clientCode, campaignCode, taskId, lane, ...rest] = parts;
  const fileName = rest.join('/');
  if (!CODE_RE.test(clientCode) || !CODE_RE.test(campaignCode)) return null;
  if (!TASK_RE.test(taskId) || !LANES.has(lane as CpWeaveLane) || !fileName) return null;
  return {
    clientCode,
    campaignCode,
    taskId,
    lane: lane as CpWeaveLane,
    fileName,
  };
}

export function parseWeaveFileName(fileName: string): {
  taskId: string;
  version: number;
  ratio: string;
  ext: string;
} | null {
  const match = FILE_RE.exec(String(fileName ?? '').trim());
  if (!match) return null;
  const ratio = match[3];
  if (!RATIOS.has(ratio)) return null;
  return {
    taskId: match[1],
    version: Number(match[2]),
    ratio,
    ext: match[4].toLowerCase(),
  };
}

export function nextWeaveTaskId(ymd: string, seq: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!match || !Number.isInteger(seq) || seq < 1) {
    throw new Error('invalid_task_id_input');
  }
  return `CR-${match[1]}-${match[2]}${match[3]}-${String(seq).padStart(3, '0')}`;
}
