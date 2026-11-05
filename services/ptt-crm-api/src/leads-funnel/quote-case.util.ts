/** Quote handoff after Solution is submitted. Separate from Sale receive / reassign SLA. */

export const QUOTE_ACCEPT_MINUTES = 15;
export const QUOTE_FINISH_HOURS = 2;

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
  implementation_status: string;
}

export type QuoteCasePhase =
  | 'sale_approve_solution'
  | 'chuyen_bao_gia'
  | 'bao_gia'
  | 'sale_review'
  | 'trien_khai';

export interface QuoteCaseView {
  phase: QuoteCasePhase;
  step_label: string;
  expected_role: 'Sale' | 'Marketing Leader' | '';
  accept_due_at: string;
  quote_due_at: string;
  change_note: string;
  ceo_escalation: string;
  solution_approved_at: string;
  quote_accepted_at: string;
  quote_sent_back_at: string;
  quote_approved_at: string;
  implementation_status: string;
}

function parseTime(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
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
  if (quoteApproved) {
    phase = 'trien_khai';
    stepLabel = 'Triển Khai';
    expected = '';
  } else if (sentBack) {
    phase = 'sale_review';
    stepLabel = 'Báo giá chờ Sale';
    expected = 'Sale';
  } else if (accepted) {
    phase = 'bao_gia';
    stepLabel = 'Báo giá';
    expected = 'Marketing Leader';
  } else if (approved) {
    phase = 'chuyen_bao_gia';
    stepLabel = 'Chuyển Báo Giá';
    expected = 'Marketing Leader';
  }

  const acceptDue = String(row.quote_accept_due_at ?? '').trim();
  const quoteDue = String(row.quote_due_at ?? '').trim();
  const nowMs = now.getTime();
  const escalations: string[] = [];
  if (phase === 'chuyen_bao_gia') {
    const due = parseTime(acceptDue);
    if (due != null && nowMs > due) {
      escalations.push('Quá 15 phút chưa bấm Nhận Case Lên Báo Giá — đã chuyển CEO.');
    }
  }
  if (phase === 'bao_gia') {
    const due = parseTime(quoteDue);
    if (due != null && nowMs > due) {
      escalations.push('Quá 2 tiếng chưa xong báo giá — đã chuyển CEO.');
    }
  }

  return {
    phase,
    step_label: stepLabel,
    expected_role: expected,
    accept_due_at: acceptDue,
    quote_due_at: quoteDue,
    change_note: note,
    ceo_escalation: escalations.join(' '),
    solution_approved_at: String(row.solution_approved_at ?? ''),
    quote_accepted_at: String(row.quote_accepted_at ?? ''),
    quote_sent_back_at: String(row.quote_sent_back_at ?? ''),
    quote_approved_at: String(row.quote_approved_at ?? ''),
    implementation_status: quoteApproved ? 'trien_khai' : String(row.implementation_status ?? ''),
  };
}
