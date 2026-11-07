/** Solutions SLA from giai đoạn 3. Quote accept / finish timers stay in quote-case.util. */

export const SOLUTION_ACCEPT_MINUTES = 15;
export const SOLUTION_WORK_HOURS = 4;
export const SOLUTION_REVISION_HOURS = 2;
export const SOLUTION_CUSTOMER_HOURS = 8;

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const WORK_START_MINUTES = 8 * 60 + 30;
const WORK_END_MINUTES = 16 * 60;
const MONDAY_CUTOFF_MINUTES = 11 * 60;

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
  expected_role: 'Marketing Leader' | 'Sale';
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

function mondayAt1100(parts: IctParts): Date {
  const untilMonday = parts.weekday === 5 ? 3 : parts.weekday === 6 ? 2 : 1;
  const monday = addCalendarDays(parts, untilMonday);
  return ictDate(monday.year, monday.month, monday.day, MONDAY_CUTOFF_MINUTES);
}

function nextWorkStart(parts: IctParts): Date {
  const skip = parts.weekday === 5 ? 3 : parts.weekday === 6 ? 2 : 1;
  const next = addCalendarDays(parts, skip);
  return ictDate(next.year, next.month, next.day, WORK_START_MINUTES);
}

/** 4 working hours inside Mon–Fri 08:30–16:00. After 16:00 Friday, Saturday, or Sunday: Monday 11:00. */
export function solutionWorkDueAt(receivedAt: Date): Date {
  const parts = ictParts(receivedAt);
  const afterFridayOrWeekend =
    parts.weekday === 6 || parts.weekday === 0 || (parts.weekday === 5 && parts.minutes >= WORK_END_MINUTES);
  if (afterFridayOrWeekend) return mondayAt1100(parts);

  let cursor = receivedAt;
  let left = SOLUTION_WORK_HOURS * 60;
  for (let guard = 0; guard < 8 && left > 0; guard += 1) {
    const here = ictParts(cursor);
    if (here.weekday === 0 || here.weekday === 6 || here.minutes >= WORK_END_MINUTES) {
      cursor = nextWorkStart(here);
      continue;
    }
    if (here.minutes < WORK_START_MINUTES) {
      cursor = ictDate(here.year, here.month, here.day, WORK_START_MINUTES);
      continue;
    }
    const room = WORK_END_MINUTES - here.minutes;
    const take = Math.min(left, room);
    cursor = new Date(cursor.getTime() + take * 60 * 1000);
    left -= take;
  }
  return cursor;
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
      role: 'Marketing Leader',
      timer: 'Hạn nhận Solutions',
      due: String(row.solution_accept_due_at ?? '').trim(),
      warn: 3,
    },
    dang_lam: {
      step: 'Đang làm Solutions',
      role: 'Marketing Leader',
      timer: 'Hạn trả Solutions',
      due: String(row.solution_due_at ?? '').trim(),
      warn: 48,
    },
    chinh_sua: {
      step: 'Chỉnh Solutions',
      role: 'Marketing Leader',
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
    slaNote = 'Quá hạn trả Solutions. Giờ làm việc 8:30–16:00 là 4 giờ; nhận sau 16:00 thứ Sáu, thứ Bảy hoặc Chủ nhật thì hạn là 11:00 thứ Hai.';
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
