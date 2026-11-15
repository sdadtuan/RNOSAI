import type { Pool, PoolClient } from 'pg';
import { addWorkingHours, type WorkingHoursConfig } from '../lead-sla-settings/lead-sla-working-hours.util';
import { defaultLeadSlaSettingsPayload } from '../lead-sla-settings/lead-sla-settings.defaults';
import { deliveryHours } from '../leads-funnel/quote-delivery-kpi.util';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export const WORK_STATUSES = ['todo', 'in_progress', 'done', 'na'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  todo: 'Chờ làm',
  in_progress: 'Đang làm',
  done: 'Xong',
  na: 'Không áp dụng',
};

export type ActualHoursEntry = {
  staff_id: number | null;
  staff_name: string;
  hours: number;
  note: string;
  at: string;
};

export type AssigneeChangeEntry = {
  from_staff_id: number | null;
  from_name: string;
  to_staff_id: number | null;
  to_name: string;
  reason: string;
  by_staff_id: number | null;
  by_name: string;
  at: string;
};

export type DeliveryOpsScore = {
  on_time: number;
  scored: number;
  pct: number;
  quote_hours: number;
  actual_hours: number;
};

export type DeliveryStaffOps = DeliveryOpsScore & {
  staff_id: number | null;
  name: string;
};

export type DeliveryOpsSummary = {
  case: DeliveryOpsScore;
  staff: DeliveryStaffOps[];
};

const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

export function normalizeWorkStatus(raw: unknown, isDone?: boolean): WorkStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (s === 'todo' || s === 'cho' || s === 'pending' || s === 'cho lam') return 'todo';
  if (s === 'in_progress' || s === 'dang lam' || s === 'doing' || s === 'in-progress') return 'in_progress';
  if (s === 'done' || s === 'xong' || s === 'complete' || s === 'completed') return 'done';
  if (s === 'na' || s === 'n/a' || s === 'n-a' || s === 'khong ap dung' || s === 'not_applicable' || s === 'not-applicable') {
    return 'na';
  }
  if (isDone === true) return 'done';
  return 'todo';
}

export function workStatusIsDone(status: WorkStatus): boolean {
  return status === 'done' || status === 'na';
}

export async function loadWorkingCalendar(client: Queryable): Promise<{
  workingHours: WorkingHoursConfig;
  holidays: string[];
}> {
  const fallback = defaultLeadSlaSettingsPayload();
  try {
    const result = await client.query(
      `SELECT payload FROM crm_lead_sla_settings WHERE tenant_id = 'default' LIMIT 1`,
    );
    const payload = (result.rows[0] as { payload?: Record<string, unknown> } | undefined)?.payload;
    const raw = (payload?.working_hours ?? fallback.working_hours) as WorkingHoursConfig;
    const days = Array.isArray(raw?.days) && raw.days.length ? raw.days.map((d) => Number(d)) : fallback.working_hours.days;
    const start = String(raw?.start ?? fallback.working_hours.start);
    const end = String(raw?.end ?? fallback.working_hours.end);
    const holidays = Array.isArray(payload?.holidays)
      ? (payload!.holidays as unknown[]).map((h) => String(h).slice(0, 10)).filter(Boolean)
      : fallback.holidays;
    return { workingHours: { days, start, end }, holidays };
  } catch {
    return { workingHours: fallback.working_hours, holidays: fallback.holidays };
  }
}

export function dueEndAt(dueYmd: string, config: WorkingHoursConfig): Date | null {
  const m = String(dueYmd ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return null;
  const [hRaw, miRaw] = String(config.end || '18:30').split(':');
  const hour = Number(hRaw);
  const minute = Number(miRaw);
  const hh = Number.isFinite(hour) ? hour : 18;
  const mm = Number.isFinite(minute) ? minute : 30;
  return new Date(Date.UTC(year, month - 1, day, hh, mm, 0, 0) - SAIGON_OFFSET_MS);
}

export function isTaskOverdue(input: {
  workStatus: WorkStatus;
  dueDate: string | null | undefined;
  now: Date;
  workingHours: WorkingHoursConfig;
}): boolean {
  if (workStatusIsDone(input.workStatus)) return false;
  const end = dueEndAt(String(input.dueDate ?? ''), input.workingHours);
  if (!end) return false;
  return input.now.getTime() > end.getTime();
}

/** true = đúng hạn, false = trễ (xong muộn hoặc đang mở quá hạn), null = chưa chấm. */
export function taskOnTime(input: {
  workStatus: WorkStatus;
  dueDate: string | null | undefined;
  doneAt: string | null | undefined;
  now: Date;
  workingHours: WorkingHoursConfig;
}): boolean | null {
  if (input.workStatus === 'na') return null;
  const end = dueEndAt(String(input.dueDate ?? ''), input.workingHours);
  if (!end) return null;
  if (input.workStatus === 'done') {
    const done = input.doneAt ? new Date(input.doneAt) : null;
    if (!done || Number.isNaN(done.getTime())) return null;
    return done.getTime() <= end.getTime();
  }
  if (input.now.getTime() > end.getTime()) return false;
  return null;
}

export function quoteHoursFromForm(formData: Record<string, unknown> | null | undefined): number {
  const fd = formData ?? {};
  const hours = Number(fd.hours ?? fd.quote_hours ?? 0);
  const qty = Number(fd.qty ?? 1);
  return deliveryHours(hours, Number.isFinite(qty) && qty > 0 ? qty : 1);
}

export function readActualHoursLog(formData: Record<string, unknown> | null | undefined): ActualHoursEntry[] {
  const raw = (formData ?? {}).actual_hours_log;
  if (!Array.isArray(raw)) return [];
  const out: ActualHoursEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const hours = Number(rec.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    out.push({
      staff_id: rec.staff_id != null ? Number(rec.staff_id) : null,
      staff_name: String(rec.staff_name ?? '').trim(),
      hours: Math.round(hours * 100) / 100,
      note: String(rec.note ?? '').trim().slice(0, 500),
      at: String(rec.at ?? ''),
    });
  }
  return out;
}

export function sumActualHours(log: ActualHoursEntry[]): number {
  return Math.round(log.reduce((sum, row) => sum + row.hours, 0) * 100) / 100;
}

export function appendActualHoursLog(
  formData: Record<string, unknown>,
  entry: ActualHoursEntry,
): Record<string, unknown> {
  const log = [...readActualHoursLog(formData), entry];
  return {
    ...formData,
    actual_hours_log: log,
    actual_hours: sumActualHours(log),
  };
}

export function readAssigneeHistory(formData: Record<string, unknown> | null | undefined): AssigneeChangeEntry[] {
  const raw = (formData ?? {}).assignee_history;
  if (!Array.isArray(raw)) return [];
  const out: AssigneeChangeEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    out.push({
      from_staff_id: rec.from_staff_id != null ? Number(rec.from_staff_id) : null,
      from_name: String(rec.from_name ?? '').trim(),
      to_staff_id: rec.to_staff_id != null ? Number(rec.to_staff_id) : null,
      to_name: String(rec.to_name ?? '').trim(),
      reason: String(rec.reason ?? '').trim(),
      by_staff_id: rec.by_staff_id != null ? Number(rec.by_staff_id) : null,
      by_name: String(rec.by_name ?? '').trim(),
      at: String(rec.at ?? ''),
    });
  }
  return out;
}

export function appendAssigneeHistory(
  formData: Record<string, unknown>,
  entry: AssigneeChangeEntry,
): Record<string, unknown> {
  return {
    ...formData,
    assignee_history: [...readAssigneeHistory(formData), entry],
  };
}

export function ymdFromDate(d: Date): string {
  const local = new Date(d.getTime() + SAIGON_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeDueYmd(
  startedAt: Date,
  hours: number,
  qty: number,
  workingHours: WorkingHoursConfig,
  holidays: string[],
): string | null {
  const labor = deliveryHours(hours, qty);
  if (!(labor > 0)) return null;
  const due = addWorkingHours(startedAt, labor, workingHours, holidays);
  return ymdFromDate(due);
}

export type OpsTaskInput = {
  work_status: WorkStatus;
  due_date: string | null;
  done_at: string | null;
  quote_hours: number;
  actual_hours: number;
  assignee: string | null;
  assignee_staff_id: number | null;
};

function emptyScore(): DeliveryOpsScore {
  return { on_time: 0, scored: 0, pct: 0, quote_hours: 0, actual_hours: 0 };
}

function withPct(score: DeliveryOpsScore): DeliveryOpsScore {
  return { ...score, pct: score.scored > 0 ? Math.round((score.on_time / score.scored) * 100) : 0 };
}

export function summarizeDeliveryOps(
  tasks: OpsTaskInput[],
  workingHours: WorkingHoursConfig,
  now = new Date(),
): DeliveryOpsSummary {
  const caseScore = emptyScore();
  const byStaff = new Map<string, DeliveryStaffOps>();

  const bump = (score: DeliveryOpsScore, task: OpsTaskInput, onTime: boolean | null) => {
    score.quote_hours = Math.round((score.quote_hours + task.quote_hours) * 100) / 100;
    score.actual_hours = Math.round((score.actual_hours + task.actual_hours) * 100) / 100;
    if (onTime == null) return;
    score.scored += 1;
    if (onTime) score.on_time += 1;
  };

  for (const task of tasks) {
    const onTime = taskOnTime({
      workStatus: task.work_status,
      dueDate: task.due_date,
      doneAt: task.done_at,
      now,
      workingHours,
    });
    bump(caseScore, task, onTime);
    const staffId = task.assignee_staff_id != null && task.assignee_staff_id > 0 ? task.assignee_staff_id : null;
    const name = String(task.assignee ?? '').trim() || (staffId != null ? `#${staffId}` : 'Chưa gán');
    const key = staffId != null ? `id:${staffId}` : `name:${name.toLowerCase()}`;
    const current = byStaff.get(key) ?? { staff_id: staffId, name, ...emptyScore() };
    bump(current, task, onTime);
    byStaff.set(key, current);
  }

  const staff = [...byStaff.values()]
    .map((row) => ({ ...row, ...withPct(row) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return { case: withPct(caseScore), staff };
}

export function readReworkCount(form: Record<string, unknown>): number {
  const n = Number(form.rework_count);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function bumpReworkCount(
  form: Record<string, unknown>,
  entry: { at: string; by_staff_id: number | null; by_name: string; from_status: string; to_status: string },
): Record<string, unknown> {
  const log = Array.isArray(form.rework_log) ? [...form.rework_log] : [];
  log.push(entry);
  return { ...form, rework_count: readReworkCount(form) + 1, rework_log: log };
}
