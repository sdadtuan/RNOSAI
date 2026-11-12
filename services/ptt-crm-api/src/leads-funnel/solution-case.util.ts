/** Solutions SLA from giai đoạn 3. Quote accept / finish timers stay in quote-case.util. */

import { addBusinessHours } from './business-hours.util';

export const SOLUTION_ACCEPT_MINUTES = 15;
export const SOLUTION_WORK_HOURS = 4;

export type SolutionWorkDueSettings = {
  cutoffTime?: string;
  beforeCutoffHours?: number;
  afterCutoffTime?: string;
  workStartTime?: string;
};

export const DEFAULT_SOLUTION_WORK_SETTINGS = {
  cutoffTime: '15:30',
  beforeCutoffHours: 4,
  afterCutoffTime: '11:00',
  workStartTime: '08:30',
} as const;
export const SOLUTION_REVISION_HOURS = 2;
export const SOLUTION_CUSTOMER_HOURS = 8;

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseClock(raw: string | undefined, fallback: number): number {
  const m = TIME_RE.exec(String(raw ?? '').trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function resolveSolutionWorkDueSettings(
  raw?: SolutionWorkDueSettings,
): {
  cutoffTime: string;
  beforeCutoffHours: number;
  afterCutoffTime: string;
  workStartTime: string;
} {
  const hours = Number(raw?.beforeCutoffHours);
  return {
    cutoffTime: TIME_RE.test(String(raw?.cutoffTime ?? '').trim())
      ? String(raw?.cutoffTime).trim()
      : DEFAULT_SOLUTION_WORK_SETTINGS.cutoffTime,
    beforeCutoffHours:
      Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_SOLUTION_WORK_SETTINGS.beforeCutoffHours,
    afterCutoffTime: TIME_RE.test(String(raw?.afterCutoffTime ?? '').trim())
      ? String(raw?.afterCutoffTime).trim()
      : DEFAULT_SOLUTION_WORK_SETTINGS.afterCutoffTime,
    workStartTime: TIME_RE.test(String(raw?.workStartTime ?? '').trim())
      ? String(raw?.workStartTime).trim()
      : DEFAULT_SOLUTION_WORK_SETTINGS.workStartTime,
  };
}

export interface SolutionCaseSource {
  handoff_status: string;
  solution_approved_at: string;
  solution_owner_staff_id: number | null;
  solution_owner_name: string;
  solution_accept_due_at: string;
  solution_claimed_at: string;
  solution_due_at: string;
  solution_released_at: string;
  solution_customer_due_at: string;
  solution_revision_note: string;
  solution_revision_due_at: string;
}

export type SolutionCasePhase = 'cho_nhan' | 'dang_lam' | 'chinh_sua' | 'cho_phan_hoi';

export interface SolutionCaseView {
  phase: SolutionCasePhase;
  step_label: string;
  expected_role: 'AM' | 'Sale';
  assignee_staff_id: number | null;
  assignee_name: string;
  revision_note: string;
  timer_label: string;
  timer_due_at: string;
  timer_overdue: boolean;
  timer_warning: boolean;
  timer_stopped: boolean;
  warning_note: string;
  sla_note: string;
}

interface IctParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number;
}

function ictParts(date: Date): IctParts {
  const shifted = new Date(date.getTime() + ICT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function ictDate(year: number, month: number, day: number, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(year, month, day, hours, mins) - ICT_OFFSET_MS);
}

function addCalendarDays(parts: IctParts, days: number): Pick<IctParts, 'year' | 'month' | 'day'> {
  const next = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate() };
}

function nextWorkingDayAt(parts: IctParts, clockMinutes: number): Date {
  let cursor = addCalendarDays(parts, 1);
  let weekday = new Date(Date.UTC(cursor.year, cursor.month, cursor.day)).getUTCDay();
  while (weekday === 0 || weekday === 6) {
    cursor = addCalendarDays(
      { year: cursor.year, month: cursor.month, day: cursor.day, weekday, minutes: 0 },
      1,
    );
    weekday = new Date(Date.UTC(cursor.year, cursor.month, cursor.day)).getUTCDay();
  }
  return ictDate(cursor.year, cursor.month, cursor.day, clockMinutes);
}

/** Before cutoff: add configured hours (clock starts at work start if earlier). After cutoff T2–T6 or weekend: next working day at the after-cutoff time. */
/** 4 working hours (08:30-16:00 weekdays) from the moment the case is received. */
export function solutionWorkDueAt(receivedAt: Date, rawSettings?: SolutionWorkDueSettings): Date {
  const settings = resolveSolutionWorkDueSettings(rawSettings);
  return addBusinessHours(receivedAt, settings.beforeCutoffHours);
}

function parseTime(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function clock(
  dueAt: string,
  now: Date,
  warnMinutes: number,
): { overdue: boolean; warning: boolean } {
  const due = parseTime(dueAt);
  if (due == null) return { overdue: false, warning: false };
  if (now.getTime() > due) return { overdue: true, warning: false };
  return { overdue: false, warning: due - now.getTime() <= warnMinutes * 60 * 1000 };
}

export function buildSolutionCaseView(row: SolutionCaseSource, now: Date): SolutionCaseView | null {
  if (String(row.solution_approved_at ?? '').trim()) return null;
  const handoff = String(row.handoff_status ?? '').trim();
  const revisionDue = String(row.solution_revision_due_at ?? '').trim();
  const revising = handoff === 'with_solution' && Boolean(revisionDue);
  let phase: SolutionCasePhase | null = null;
  if (handoff === 'pending') phase = 'cho_nhan';
  else if (revising) phase = 'chinh_sua';
  else if (handoff === 'with_solution') phase = 'dang_lam';
  else if (handoff === 'released') phase = 'cho_phan_hoi';
  if (!phase) return null;

  const assigneeId = Number(row.solution_owner_staff_id);
  const labels: Record<SolutionCasePhase, { step: string; role: SolutionCaseView['expected_role']; timer: string; due: string; warn: number }> = {
    cho_nhan: {
      step: 'Lead chờ Solutions',
      role: 'AM',
      timer: 'Hạn nhận Solutions',
      due: String(row.solution_accept_due_at ?? '').trim(),
      warn: 3,
    },
    dang_lam: {
      step: 'Đang làm Solutions',
      role: 'AM',
      timer: 'Hạn trả Solutions',
      due: String(row.solution_due_at ?? '').trim(),
      warn: 48,
    },
    chinh_sua: {
      step: 'Chỉnh Solutions',
      role: 'AM',
      timer: 'Hạn trả Solutions đã chỉnh',
      due: revisionDue,
      warn: 24,
    },
    cho_phan_hoi: {
      step: 'Chờ phản hồi khách',
      role: 'Sale',
      timer: 'Hạn phản hồi khách',
      due: String(row.solution_customer_due_at ?? '').trim(),
      warn: 96,
    },
  };
  const meta = labels[phase];
  const state = clock(meta.due, now, meta.warn);
  let warningNote = '';
  let slaNote = '';
  if (state.warning && phase === 'cho_nhan') warningNote = 'Sắp hết 15 phút nhận case Solutions.';
  if (state.warning && phase === 'dang_lam') warningNote = 'Sắp đến hạn trả Solutions.';
  if (state.warning && phase === 'chinh_sua') warningNote = 'Sắp hết 2 giờ chỉnh Solutions.';
  if (state.warning && phase === 'cho_phan_hoi') warningNote = 'Sắp hết 8 giờ phản hồi khách.';
  if (state.overdue && phase === 'cho_nhan') slaNote = 'Quá 15 phút chưa bấm nhận case Solutions.';
  if (state.overdue && phase === 'dang_lam') {
    slaNote = 'Quá hạn trả Solutions. Trước mốc cắt cộng số giờ cấu hình; sau mốc cắt (T2–T6) hạn là giờ đã đặt vào ngày làm việc kế tiếp.';
  }
  if (state.overdue && phase === 'chinh_sua') slaNote = 'Quá 2 giờ chưa trả Solutions đã chỉnh.';
  if (state.overdue && phase === 'cho_phan_hoi') slaNote = 'Quá 8 giờ chưa có phản hồi khách về Solutions.';

  return {
    phase,
    step_label: meta.step,
    expected_role: meta.role,
    assignee_staff_id: Number.isInteger(assigneeId) && assigneeId > 0 ? assigneeId : null,
    assignee_name: String(row.solution_owner_name ?? '').trim(),
    revision_note: String(row.solution_revision_note ?? '').trim(),
    timer_label: meta.due ? meta.timer : '',
    timer_due_at: meta.due,
    timer_overdue: state.overdue,
    timer_warning: state.warning,
    timer_stopped: false,
    warning_note: warningNote,
    sla_note: slaNote,
  };
}
