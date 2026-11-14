/** Solutions SLA from giai đoạn 3. Quote accept / finish timers stay in quote-case.util. */

import {
  addBusinessHours,
  businessCalendar,
  ictParts,
  isWorkingDay,
  nextWorkingDayAt,
  type BusinessCalendar,
} from './business-hours.util';

export const SOLUTION_ACCEPT_MINUTES = 15;
export const SOLUTION_WORK_HOURS = 4;

export type SolutionWorkDueSettings = {
  cutoffTime?: string;
  beforeCutoffHours?: number;
  afterCutoffTime?: string;
  workStartTime?: string;
  /** "Hạn sửa Solutions (giờ)" (business hours). */
  revisionHours?: number;
};

export const DEFAULT_SOLUTION_WORK_SETTINGS = {
  cutoffTime: '15:30',
  beforeCutoffHours: 4,
  afterCutoffTime: '11:00',
  workStartTime: '08:30',
} as const;
export const SOLUTION_REVISION_HOURS = 2;
export const SOLUTION_CUSTOMER_HOURS = 8;

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
  missing_info_due_at?: string;
}

export type SolutionCasePhase = 'cho_nhan' | 'dang_lam' | 'chinh_sua' | 'cho_phan_hoi' | 'bo_sung';

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

/**
 * Before the cut-off (Mốc cắt, default 15:30): add the configured business hours (clock starts at the
 * shift start if earlier). After the cut-off, or on a day off / holiday: next working day at the
 * after-cut-off time (default 11:00). Calendar: the Marketing team's from the SLA config.
 */
export function solutionWorkDueAt(
  receivedAt: Date,
  rawSettings?: SolutionWorkDueSettings,
  cal: BusinessCalendar = businessCalendar('marketing'),
): Date {
  const settings = resolveSolutionWorkDueSettings(rawSettings);
  const parts = ictParts(receivedAt);
  const cutoffMin = parseClock(settings.cutoffTime, 15 * 60 + 30);
  const afterMin = parseClock(settings.afterCutoffTime, 11 * 60);
  if (!isWorkingDay(parts, cal) || parts.minutes >= cutoffMin) {
    return nextWorkingDayAt(parts, afterMin, cal);
  }
  return addBusinessHours(receivedAt, settings.beforeCutoffHours, cal);
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

export function buildSolutionCaseView(
  row: SolutionCaseSource,
  now: Date,
  opts?: { acceptMinutes?: number; missingInfoHours?: number },
): SolutionCaseView | null {
  const rawAccept = Number(opts?.acceptMinutes);
  const acceptMinutes = Number.isFinite(rawAccept) && rawAccept >= 0 ? rawAccept : SOLUTION_ACCEPT_MINUTES;
  const acceptLabel = acceptMinutes === 1 ? '1 phút' : `${acceptMinutes} phút`;
  const rawHours = Number(opts?.missingInfoHours);
  const missingHours = Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 1;
  const missingLabel = missingHours === 1 ? '1 giờ' : `${missingHours} giờ`;

  if (String(row.solution_approved_at ?? '').trim()) return null;
  const handoff = String(row.handoff_status ?? '').trim();
  const revisionDue = String(row.solution_revision_due_at ?? '').trim();
  const revising = handoff === 'with_solution' && Boolean(revisionDue);
  let phase: SolutionCasePhase | null = null;
  if (handoff === 'pending') phase = 'cho_nhan';
  else if (revising) phase = 'chinh_sua';
  else if (handoff === 'with_solution') phase = 'dang_lam';
  else if (handoff === 'released') phase = 'cho_phan_hoi';
  else if (handoff === 'returned' || handoff === 'returned_to_sales' || handoff === 'return') phase = 'bo_sung';
  if (!phase) return null;

  const assigneeId = Number(row.solution_owner_staff_id);
  const labels: Record<SolutionCasePhase, { step: string; role: SolutionCaseView['expected_role']; timer: string; due: string; warn: number }> = {
    cho_nhan: {
      step: 'Lead chờ Solutions',
      role: 'AM',
      timer: 'Hạn AM nhận / làm Solution',
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
    bo_sung: {
      step: 'Bổ sung thông tin',
      role: 'Sale',
      timer: 'Hạn bổ sung thông tin',
      due: String(row.missing_info_due_at ?? '').trim(),
      warn: 15,
    },
  };
  const meta = labels[phase];
  const state = clock(meta.due, now, meta.warn);
  let warningNote = '';
  let slaNote = '';
  if (state.warning && phase === 'cho_nhan') warningNote = 'Sắp hết ' + acceptLabel + ' nhận case Solutions.';
  if (state.warning && phase === 'dang_lam') warningNote = 'Sắp đến hạn trả Solutions.';
  if (state.warning && phase === 'chinh_sua') warningNote = 'Sắp hết 2 giờ chỉnh Solutions.';
  if (state.warning && phase === 'cho_phan_hoi') warningNote = 'Sắp hết 8 giờ phản hồi khách.';
  if (state.overdue && phase === 'cho_nhan') slaNote = 'Quá ' + acceptLabel + ' chưa bấm nhận case Solutions.';
  if (state.overdue && phase === 'dang_lam') {
    slaNote = 'Quá hạn trả Solutions. Trước mốc cắt cộng số giờ cấu hình; sau mốc cắt (T2–T6) hạn là giờ đã đặt vào ngày làm việc kế tiếp.';
  }
  if (state.overdue && phase === 'chinh_sua') slaNote = 'Quá 2 giờ chưa trả Solutions đã chỉnh.';
  if (state.overdue && phase === 'cho_phan_hoi') slaNote = 'Quá 8 giờ chưa có phản hồi khách về Solutions.';
  if (state.warning && phase === 'bo_sung') warningNote = 'Sắp hết ' + missingLabel + ' bổ sung thông tin.';
  if (state.overdue && phase === 'bo_sung') slaNote = 'Quá ' + missingLabel + ' chưa bổ sung thông tin.';

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
