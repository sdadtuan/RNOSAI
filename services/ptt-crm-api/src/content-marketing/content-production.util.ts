import { BadRequestException } from '@nestjs/common';
import type { CmktETask } from '../content-os-portfolio/production-capacity.util';
import type { CmktItemRow, CmktProductionJson, CmktProductionPhase } from './content-marketing.types';

const TASK_STATUSES = new Set<CmktETask['status']>(['todo', 'doing', 'done', 'blocked']);

function invalidTasks(message: string, extra?: Record<string, unknown>): never {
  throw new BadRequestException({ error: 'invalid_tasks', message, ...extra });
}

function parseOptionalRaciNote(value: unknown, field: string, index: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    invalidTasks(`tasks[${index}].raci.${field} must be a string`, { index, field });
  }
  return value;
}

function parseCmktETask(raw: unknown, index: number): CmktETask {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    invalidTasks(`tasks[${index}] must be an object`, { index });
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id.trim()) {
    invalidTasks(`tasks[${index}].id must be a non-empty string`, { index });
  }
  if (typeof row.title !== 'string') {
    invalidTasks(`tasks[${index}].title must be a string`, { index });
  }
  if (row.assignee_id !== null && (typeof row.assignee_id !== 'number' || !Number.isFinite(row.assignee_id))) {
    invalidTasks(`tasks[${index}].assignee_id must be a number or null`, { index });
  }
  if (row.raci == null || typeof row.raci !== 'object' || Array.isArray(row.raci)) {
    invalidTasks(`tasks[${index}].raci must be an object`, { index });
  }
  const raciRaw = row.raci as Record<string, unknown>;
  if (typeof raciRaw.r !== 'string' || typeof raciRaw.a !== 'string') {
    invalidTasks(`tasks[${index}].raci.r and raci.a must be strings`, { index });
  }
  if (!Array.isArray(row.depends_on) || row.depends_on.some((dep) => typeof dep !== 'string')) {
    invalidTasks(`tasks[${index}].depends_on must be a string array`, { index });
  }
  if (typeof row.sla_h !== 'number' || !Number.isFinite(row.sla_h)) {
    invalidTasks(`tasks[${index}].sla_h must be a finite number`, { index });
  }
  if (typeof row.effort_h !== 'number' || !Number.isFinite(row.effort_h)) {
    invalidTasks(`tasks[${index}].effort_h must be a finite number`, { index });
  }
  if (typeof row.status !== 'string' || !TASK_STATUSES.has(row.status as CmktETask['status'])) {
    invalidTasks(`tasks[${index}].status must be todo, doing, done, or blocked`, { index });
  }
  return {
    id: row.id.trim(),
    title: row.title,
    assignee_id: row.assignee_id,
    raci: {
      r: raciRaw.r,
      a: raciRaw.a,
      c: parseOptionalRaciNote(raciRaw.c, 'c', index),
      i: parseOptionalRaciNote(raciRaw.i, 'i', index),
    },
    depends_on: row.depends_on as string[],
    sla_h: row.sla_h,
    effort_h: row.effort_h,
    status: row.status as CmktETask['status'],
  };
}

function parseCmktETasks(value: unknown): CmktETask[] {
  if (!Array.isArray(value)) {
    invalidTasks('tasks must be an array');
  }
  return value.map((row, index) => parseCmktETask(row, index));
}

export function itemNeedsProduction(item: CmktItemRow): boolean {
  if (item.format === 'carousel') return true;
  if (item.format === 'video_script') return true;
  if (item.brief_json?.needs_visual === true) return true;
  return false;
}

export function defaultProductionPhase(item: CmktItemRow): CmktProductionPhase {
  if (!itemNeedsProduction(item)) return 'none';
  if (item.format === 'video_script') return 'awaiting_video';
  if (item.format === 'carousel' || item.brief_json?.needs_visual === true) return 'awaiting_design';
  return 'none';
}

export function mergeProductionJson(
  existing: CmktProductionJson | undefined,
  patch: Record<string, unknown>,
): CmktProductionJson {
  const next: CmktProductionJson = { ...(existing ?? {}) };
  if (patch.phase != null) next.phase = String(patch.phase) as CmktProductionPhase;
  if (patch.assignee_designer_id !== undefined) {
    next.assignee_designer_id =
      patch.assignee_designer_id != null ? Number(patch.assignee_designer_id) : null;
  }
  if (patch.assignee_video_id !== undefined) {
    next.assignee_video_id = patch.assignee_video_id != null ? Number(patch.assignee_video_id) : null;
  }
  if (patch.brief_exported_at !== undefined) {
    next.brief_exported_at = patch.brief_exported_at != null ? String(patch.brief_exported_at) : null;
  }
  if (patch.final_video_url !== undefined) {
    next.final_video_url = patch.final_video_url != null ? String(patch.final_video_url).trim() : null;
  }
  if (patch.subtitle_text !== undefined) {
    next.subtitle_text = patch.subtitle_text != null ? String(patch.subtitle_text) : null;
  }
  if (patch.creative_id !== undefined) {
    next.creative_id = patch.creative_id != null ? String(patch.creative_id).trim() : null;
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes != null ? String(patch.notes) : null;
  }
  if (patch.escalate_human !== undefined) {
    next.escalate_human = Boolean(patch.escalate_human);
  }
  if (Array.isArray(patch.asset_urls)) {
    next.asset_urls = patch.asset_urls.map((u) => String(u).trim()).filter(Boolean);
  } else if (patch.asset_urls !== undefined && patch.asset_urls != null) {
    next.asset_urls = [String(patch.asset_urls).trim()].filter(Boolean);
  }
  if (Array.isArray(patch.chapter_markers)) {
    next.chapter_markers = patch.chapter_markers.map((m) => String(m)).filter(Boolean);
  }
  if (patch.effort_h !== undefined) {
    const hours = Number(patch.effort_h);
    next.effort_h = Number.isFinite(hours) ? hours : undefined;
  }
  if (patch.tasks !== undefined) {
    next.tasks = parseCmktETasks(patch.tasks);
  }
  return next;
}

export function assertProductionGateForPublish(item: CmktItemRow): void {
  if (!itemNeedsProduction(item)) return;
  if (item.format === 'carousel' && item.visual_status === 'approved') return;
  const phase = item.production_json?.phase ?? defaultProductionPhase(item);
  if (phase !== 'done') {
    throw new BadRequestException({
      error: 'production_not_done',
      message: 'Item cần hoàn tất production (phase=done) trước khi publish.',
      phase,
      format: item.format,
    });
  }
}

export function buildDesignBriefMarkdown(item: CmktItemRow): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  return [
    `# Creative brief — ${item.title}`,
    '',
    `Channel: ${item.channel} / ${item.format}`,
    `Goal: ${item.funnel_goal || '—'}`,
    '',
    '## Copy đã duyệt',
    '',
    md || '(empty)',
    '',
    '## Ghi chú',
    '',
    String(item.production_json?.notes ?? item.brief_json?.notes ?? '—'),
  ].join('\n');
}

export function buildScriptExportMarkdown(item: CmktItemRow): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  return [`# Video script — ${item.title}`, '', md || '(empty)'].join('\n');
}
