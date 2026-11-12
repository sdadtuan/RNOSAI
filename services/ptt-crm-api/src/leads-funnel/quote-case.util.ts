/** Quote handoff after Solution is approved. Separate from Sale receive / reassign SLA. */

import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';

export const QUOTE_ACCEPT_MINUTES = 15;
export const QUOTE_FINISH_HOURS = 2;

export type QuoteLateTimer = 'accept' | 'finish';

export interface QuoteLateEvent {
  staff_id: number | null;
  staff_name: string;
  timer: QuoteLateTimer;
  timer_label: string;
  due_at: string;
  logged_at: string;
}

export interface QuoteCeoEscalation {
  staff_id: number | null;
  staff_name: string;
  timer: QuoteLateTimer;
  timer_label: string;
  since: string;
  escalated_at: string;
}

export interface QuoteTransferCandidate {
  id: number;
  name: string;
  title: string;
}

export type QuoteDesk = 'sale' | 'am';

/** Who must act on this quote step. Hợp đồng and Triển Khai are not reassigned here. */
export function quoteDeskForPhase(phase: QuoteCasePhase): QuoteDesk | null {
  if (phase === 'chuyen_bao_gia' || phase === 'bao_gia') return 'am';
  if (phase === 'sale_approve_solution') return 'sale';
  return null;
}

/**
 * Position code alone is not the job. Content, design and Agency Ops share the MKL code.
 * CSKH and Nhân sự share the AE code. The person who receives the case must hold the desk.
 */
export function holdsQuoteDesk(
  desk: QuoteDesk,
  row: { position_code?: string | null; job_title?: string | null; job_function?: string | null },
): boolean {
  const position = String(row.position_code ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const title = String(row.job_title ?? '').trim().toLowerCase();
  const fn = String(row.job_function ?? '').trim().toLowerCase();
  if (desk === 'am') {
    if (!isAccountManagerPosition(position)) return false;
    if (fn === 'content' || fn === 'design' || fn === 'analyst' || fn === 'technical' || fn === 'ops') {
      return false;
    }
    return true;
  }
  const salePosition = position === 'ae' || position.startsWith('ae-') || position.startsWith('ae_');
  if (!salePosition) return false;
  if (fn === 'ops') return false;
  return fn === 'sales' || title === 'account executive' || title === 'ae';
}

export interface QuoteCaseSource {
  handoff_status: string;
  solution_approved_at: string;
  quote_offered_at: string;
  quote_accept_due_at: string;
  quote_accepted_at: string;
  quote_due_at: string;
  quote_sent_back_at: string;
  quote_change_note: string;
  quote_approved_at: string;
  quote_assignee_staff_id: number | null;
  quote_assignee_name: string;
  quote_reassign_note: string;
  quote_ceo_escalated_at?: string;
  quote_late_events?: unknown;
  implementation_status: string;
  contract_created_at?: string;
  contract_signed_at?: string;
  contract_amount_vnd?: number | string;
}

export type QuoteCasePhase =
  | 'sale_approve_solution'
  | 'chuyen_bao_gia'
  | 'bao_gia'
  | 'ceo_review'
  | 'sale_review'
  | 'hop_dong'
  | 'trien_khai';

export interface QuoteCaseView {
  phase: QuoteCasePhase;
  step_label: string;
  expected_role: 'Sale' | 'AM' | 'CEO' | '';
  accept_due_at: string;
  quote_due_at: string;
  change_note: string;
  assignee_staff_id: number | null;
  assignee_name: string;
  reassign_note: string;
  timer_label: string;
  timer_due_at: string;
  timer_overdue: boolean;
  timer_warning: boolean;
  timer_stopped: boolean;
  warning_note: string;
  sla_note: string;
  solution_approved_at: string;
  quote_accepted_at: string;
  quote_sent_back_at: string;
  quote_approved_at: string;
  implementation_status: string;
  contract_state: 'none' | 'draft' | 'signed';
  contract_amount_vnd: number;
  ceo_escalation: QuoteCeoEscalation | null;
  late_events: QuoteLateEvent[];
  transfer_candidates: QuoteTransferCandidate[];
}

export function isCeoPosition(positionCode: string | null | undefined): boolean {
  return String(positionCode ?? '').trim().toUpperCase() === 'CEO';
}

export function quoteTimerLabel(timer: QuoteLateTimer): string {
  return timer === 'accept' ? 'Nhận case 15 phút' : 'Nộp báo giá 2 giờ';
}

export function quoteDeadlineIso(raw: string): string {
  const ms = Date.parse(String(raw ?? '').trim());
  return Number.isFinite(ms) ? new Date(ms).toISOString() : String(raw ?? '').trim();
}

export function quoteLateEventKey(event: {
  timer: string;
  due_at: string;
  staff_id: number | null;
}): string {
  return `${event.timer}|${event.staff_id ?? ''}|${quoteDeadlineIso(event.due_at)}`;
}

export function readQuoteLateEvents(raw: unknown): QuoteLateEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: QuoteLateEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const timer = row.timer === 'finish' ? 'finish' : row.timer === 'accept' ? 'accept' : null;
    if (!timer) continue;
    const staffId = Number(row.staff_id);
    out.push({
      staff_id: Number.isInteger(staffId) && staffId > 0 ? staffId : null,
      staff_name: String(row.staff_name ?? '').trim(),
      timer,
      timer_label: String(row.timer_label ?? '').trim() || quoteTimerLabel(timer),
      due_at: quoteDeadlineIso(String(row.due_at ?? '')),
      logged_at: quoteDeadlineIso(String(row.logged_at ?? '')),
    });
  }
  return out;
}

/** Automatic reassignment left this note. A CEO transfer starts with "CEO chuyển". */
export function quoteWasAutoReassigned(note: string): boolean {
  const text = String(note ?? '').trim();
  if (!text || text.startsWith('CEO chuyển')) return false;
  return text.includes('đã chuyển cho');
}

function parseTime(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function cleanStaffIds(candidateIds: number[]): number[] {
  return [...new Set(candidateIds.filter((id) => Number.isInteger(id) && id > 0))].sort((left, right) => left - right);
}

/** Prefer the Solution owner when they are AM. Otherwise the first active one. */
export function preferredAccountManagerId(candidateIds: number[], preferredId: number | null): number | null {
  const ids = cleanStaffIds(candidateIds);
  if (preferredId != null && preferredId > 0 && ids.includes(preferredId)) return preferredId;
  return ids[0] ?? null;
}

/** @deprecated Use preferredAccountManagerId — kept for grandfathered in-flight rows in tests. */
export const preferredMarketingLeaderId = preferredAccountManagerId;

export function isGrandfatheredQuoteMarketingLeader(
  positionCode: string | null | undefined,
): boolean {
  return isMarketingLeaderPosition(positionCode);
}

/** Same statuses as the ops-web Báo giá kanban column. */
export const BAO_GIA_COLUMN_STATUSES = ['bao_gia', 'proposal', 'dam_phan', 'negotiation'] as const;

export function isBaoGiaColumnStatus(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim().toLowerCase();
  return (BAO_GIA_COLUMN_STATUSES as readonly string[]).includes(value);
}

export function buildQuoteCaseView(row: QuoteCaseSource, now: Date): QuoteCaseView | null {
  const approved = Boolean(String(row.solution_approved_at ?? '').trim());
  const accepted = Boolean(String(row.quote_accepted_at ?? '').trim());
  const sentBack = Boolean(String(row.quote_sent_back_at ?? '').trim());
  const quoteApproved = Boolean(String(row.quote_approved_at ?? '').trim());
  const note = String(row.quote_change_note ?? '').trim();
  const quoteStarted = accepted || sentBack || quoteApproved || Boolean(note);
  if (row.handoff_status !== 'released' && !quoteStarted) return null;

  let phase: QuoteCasePhase = 'sale_approve_solution';
  let stepLabel = '';
  let expected: QuoteCaseView['expected_role'] = 'Sale';
  const releasedToDelivery = String(row.implementation_status ?? '').trim() === 'trien_khai';
  if (quoteApproved && releasedToDelivery) {
    phase = 'trien_khai';
    stepLabel = 'Triển Khai';
    expected = '';
  } else if (quoteApproved) {
    phase = 'hop_dong';
    stepLabel = 'Hợp đồng';
    expected = 'AM';
  } else if (sentBack) {
    phase = 'ceo_review';
    stepLabel = 'Chờ CEO duyệt';
    expected = 'CEO';
  } else if (accepted) {
    phase = 'bao_gia';
    stepLabel = note ? 'Chỉnh sửa báo giá' : 'Chờ lập báo giá';
    expected = 'AM';
  } else if (approved) {
    phase = 'chuyen_bao_gia';
    stepLabel = 'Chuyển Báo Giá';
    expected = 'AM';
  }

  const acceptDue = String(row.quote_accept_due_at ?? '').trim();
  const quoteDue = String(row.quote_due_at ?? '').trim();
  const timerStopped = phase === 'ceo_review' || phase === 'hop_dong' || phase === 'trien_khai';
  let timerLabel = '';
  let timerDue = '';
  if (!timerStopped && phase === 'chuyen_bao_gia') {
    timerLabel = 'Hạn nhận case';
    timerDue = acceptDue;
  } else if (!timerStopped && phase === 'bao_gia') {
    timerLabel = 'Hạn nộp báo giá';
    timerDue = quoteDue;
  }
  const dueMs = parseTime(timerDue);
  const timerOverdue = dueMs != null && now.getTime() > dueMs;
  const warnMs = phase === 'chuyen_bao_gia' ? 3 * 60 * 1000 : 12 * 60 * 1000;
  const timerWarning = !timerStopped && !timerOverdue && dueMs != null && dueMs - now.getTime() <= warnMs;
  let warningNote = '';
  if (timerWarning && phase === 'chuyen_bao_gia') warningNote = 'Sắp hết 15 phút nhận case báo giá.';
  if (timerWarning && phase === 'bao_gia') warningNote = `Sắp hết ${QUOTE_FINISH_HOURS} giờ nộp báo giá.`;
  let slaNote = '';
  if (phase === 'chuyen_bao_gia' && timerOverdue) {
    slaNote = `Quá ${QUOTE_ACCEPT_MINUTES} phút chưa bấm Nhận Case Báo Giá. Giữ nguyên AM và báo CEO.`;
  } else if (phase === 'bao_gia' && timerOverdue) {
    slaNote = `Quá ${QUOTE_FINISH_HOURS} giờ chưa nộp báo giá cho Sale. Giữ nguyên AM và báo CEO.`;
  }

  const contractSigned = Boolean(String(row.contract_signed_at ?? '').trim());
  const contractCreated = contractSigned || Boolean(String(row.contract_created_at ?? '').trim());
  const contractState = contractSigned ? 'signed' : contractCreated ? 'draft' : 'none';
  const contractAmount = Number(row.contract_amount_vnd);
  const assigneeId = Number(row.quote_assignee_staff_id);
  const assigneeStaffId = Number.isInteger(assigneeId) && assigneeId > 0 ? assigneeId : null;
  const assigneeName = String(row.quote_assignee_name ?? '').trim();
  const lateEvents = readQuoteLateEvents(row.quote_late_events);
  const escalatedAt = String(row.quote_ceo_escalated_at ?? '').trim();
  let ceoEscalation: QuoteCeoEscalation | null = null;
  if (timerOverdue && (phase === 'chuyen_bao_gia' || phase === 'bao_gia')) {
    const timer: QuoteLateTimer = phase === 'chuyen_bao_gia' ? 'accept' : 'finish';
    ceoEscalation = {
      staff_id: assigneeStaffId,
      staff_name: assigneeName,
      timer,
      timer_label: quoteTimerLabel(timer),
      since: timerDue,
      escalated_at: escalatedAt,
    };
  } else if (escalatedAt && (phase === 'chuyen_bao_gia' || phase === 'bao_gia')) {
    const latest = lateEvents[lateEvents.length - 1];
    if (latest) {
      ceoEscalation = {
        staff_id: latest.staff_id,
        staff_name: latest.staff_name || assigneeName,
        timer: latest.timer,
        timer_label: latest.timer_label,
        since: latest.due_at,
        escalated_at: escalatedAt,
      };
    }
  }
  return {
    phase,
    step_label: stepLabel,
    expected_role: expected,
    accept_due_at: acceptDue,
    quote_due_at: timerStopped ? '' : quoteDue,
    change_note: note,
    assignee_staff_id: assigneeStaffId,
    assignee_name: assigneeName,
    reassign_note: String(row.quote_reassign_note ?? '').trim(),
    timer_label: timerLabel,
    timer_due_at: timerDue,
    timer_overdue: timerOverdue,
    timer_warning: timerWarning,
    timer_stopped: timerStopped,
    warning_note: warningNote,
    sla_note: slaNote,
    solution_approved_at: String(row.solution_approved_at ?? ''),
    quote_accepted_at: String(row.quote_accepted_at ?? ''),
    quote_sent_back_at: String(row.quote_sent_back_at ?? ''),
    quote_approved_at: String(row.quote_approved_at ?? ''),
    implementation_status: releasedToDelivery
      ? 'trien_khai'
      : quoteApproved
        ? 'hop_dong'
        : String(row.implementation_status ?? ''),
    contract_state: quoteApproved ? contractState : 'none',
    contract_amount_vnd: Number.isFinite(contractAmount) && contractAmount > 0 ? Math.round(contractAmount) : 0,
    ceo_escalation: ceoEscalation,
    late_events: lateEvents,
    transfer_candidates: [],
  };
}
