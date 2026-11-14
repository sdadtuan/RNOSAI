/**
 * Canonical 7-step handoff SLA (Tú approved 14/11/2026).
 * Calendar: Mon–Fri 08:30–18:30 Asia/Saigon.
 */
import {
  acceptDueAt,
  addBusinessDays,
  addBusinessHours,
  ictParts,
  isWeekend,
  nextWorkingDayAt,
  parseClockMinutes,
} from './business-hours.util';
import { solutionWorkDueAt, type SolutionWorkDueSettings } from './solution-case.util';

export const HANDOFF_SLA_POLICY = {
  calendar: 'T2–T6 08:30–18:30 Asia/Saigon',
  salesAcceptMinutes: 15,
  firstUpdateHours: 1,
  briefBusinessDays: 1,
  missingInfoHours: 1,
  solutionAcceptMinutes: 15,
  solutionBeforeCutoffHours: 4,
  solutionCutoffTime: '15:30',
  solutionAfterCutoffTime: '11:00',
  revisionHours: 2,
  customerResponseHours: 8,
  quoteAcceptMinutes: 15,
  quoteFinishHours: 2,
  ceoApproveHours: 24,
  negotiateBusinessDays: 3,
  contractBusinessDays: 5,
} as const;

export type HandoffSlaState = 'na' | 'ok' | 'warning' | 'breach';

export type HandoffSlaClockKey =
  | 'sales_accept'
  | 'sales_update'
  | 'sales_brief'
  | 'missing_info'
  | 'solution_accept'
  | 'solution_work'
  | 'solution_revision'
  | 'customer_response'
  | 'quote_accept'
  | 'quote_finish'
  | 'ceo_approve'
  | 'negotiate'
  | 'contract';

export type HandoffSlaRole = 'Sales' | 'AM' | 'Marketing' | 'CEO';

export interface HandoffSlaClock {
  key: HandoffSlaClockKey;
  step_key: string;
  label: string;
  role: HandoffSlaRole;
  due_at: string | null;
  started_at: string | null;
  state: HandoffSlaState;
  remaining_ms: number | null;
  countdown: string;
  due_label: string;
  message: string;
}

export interface HandoffSlaView {
  policy: typeof HANDOFF_SLA_POLICY;
  clocks: HandoffSlaClock[];
  current: HandoffSlaClock | null;
  suggested_solution_due_at: string;
}

const WARN_MS: Record<HandoffSlaClockKey, number> = {
  sales_accept: 3 * 60_000,
  sales_update: 15 * 60_000,
  sales_brief: 2 * 60 * 60_000,
  missing_info: 15 * 60_000,
  solution_accept: 3 * 60_000,
  solution_work: 48 * 60_000,
  solution_revision: 24 * 60_000,
  customer_response: 96 * 60_000,
  quote_accept: 3 * 60_000,
  quote_finish: 24 * 60_000,
  ceo_approve: 4 * 60 * 60_000,
  negotiate: 4 * 60 * 60_000,
  contract: 8 * 60 * 60_000,
};

const LABELS: Record<HandoffSlaClockKey, { step: string; label: string; role: HandoffSlaRole }> = {
  sales_accept: { step: 'intake', label: 'Hạn nhận lead', role: 'Sales' },
  sales_update: { step: 'intake', label: 'Hạn cập nhật / gọi đầu', role: 'Sales' },
  sales_brief: { step: 'sales_brief', label: 'Hạn Submit to AM', role: 'Sales' },
  missing_info: { step: 'sales_brief', label: 'Hạn bổ sung thông tin', role: 'Sales' },
  solution_accept: { step: 'await_solution', label: 'Hạn AM nhận / giao Solutions', role: 'AM' },
  solution_work: { step: 'doing_solution', label: 'Hạn trả Solutions', role: 'Marketing' },
  solution_revision: { step: 'doing_solution', label: 'Hạn chỉnh Solutions', role: 'Marketing' },
  customer_response: { step: 'await_quote', label: 'Hạn phản hồi khách', role: 'Sales' },
  quote_accept: { step: 'await_quote', label: 'Hạn AM nhận case báo giá', role: 'AM' },
  quote_finish: { step: 'await_quote', label: 'Hạn lập báo giá', role: 'AM' },
  ceo_approve: { step: 'await_quote', label: 'Hạn CEO duyệt báo giá', role: 'CEO' },
  negotiate: { step: 'negotiate', label: 'Hạn thương thảo', role: 'AM' },
  contract: { step: 'contract', label: 'Hạn ký hợp đồng', role: 'AM' },
};

export function formatSlaCountdown(remainingMs: number | null, overdue: boolean): string {
  if (remainingMs == null) return '—';
  const abs = Math.abs(remainingMs);
  const totalMin = Math.round(abs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}n`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}p`);
  const body = parts.join(' ');
  return overdue ? `Trễ ${body}` : `Còn ${body}`;
}

export function formatSlaDueVi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(d);
}

export function classifySlaState(dueAt: Date | null, now: Date, warnMs: number): HandoffSlaState {
  if (!dueAt) return 'na';
  const remaining = dueAt.getTime() - now.getTime();
  if (remaining <= 0) return 'breach';
  if (remaining <= warnMs) return 'warning';
  return 'ok';
}

function clockOf(
  key: HandoffSlaClockKey,
  due: Date | string | null | undefined,
  started: Date | string | null | undefined,
  now: Date,
  message: string,
): HandoffSlaClock {
  const dueDate = parseDate(due);
  const startedDate = parseDate(started);
  const state = classifySlaState(dueDate, now, WARN_MS[key]);
  const remaining = dueDate ? dueDate.getTime() - now.getTime() : null;
  const meta = LABELS[key];
  return {
    key,
    step_key: meta.step,
    label: meta.label,
    role: meta.role,
    due_at: dueDate ? dueDate.toISOString() : null,
    started_at: startedDate ? startedDate.toISOString() : null,
    state,
    remaining_ms: remaining,
    countdown: formatSlaCountdown(remaining, state === 'breach'),
    due_label: formatSlaDueVi(dueDate ? dueDate.toISOString() : null),
    message,
  };
}

function parseDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function suggestedSolutionDueAt(now = new Date(), rawSettings?: SolutionWorkDueSettings): Date {
  return solutionWorkDueAt(now, rawSettings);
}

export function briefSubmitDueAt(startedAt: Date): Date {
  return addBusinessDays(startedAt, HANDOFF_SLA_POLICY.briefBusinessDays);
}

export function negotiateDueAt(approvedAt: Date): Date {
  return addBusinessDays(approvedAt, HANDOFF_SLA_POLICY.negotiateBusinessDays);
}

export function contractDueAt(approvedAt: Date): Date {
  return addBusinessDays(approvedAt, HANDOFF_SLA_POLICY.contractBusinessDays);
}

export function customerResponseDueAt(releasedAt: Date): Date {
  return new Date(releasedAt.getTime() + HANDOFF_SLA_POLICY.customerResponseHours * 3_600_000);
}

export function revisionDueAt(from: Date): Date {
  return new Date(from.getTime() + HANDOFF_SLA_POLICY.revisionHours * 3_600_000);
}

export function ceoApproveDueAt(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + HANDOFF_SLA_POLICY.ceoApproveHours * 3_600_000);
}

export function salesAcceptDueAt(assignedAt: Date): Date {
  return acceptDueAt(assignedAt, HANDOFF_SLA_POLICY.salesAcceptMinutes);
}

export function firstUpdateDueAt(claimedAt: Date): Date {
  return addBusinessHours(claimedAt, HANDOFF_SLA_POLICY.firstUpdateHours);
}

export interface HandoffSlaSource {
  currentStep?: string | null;
  assignedAt?: string | null;
  claimedAt?: string | null;
  firstCallAt?: string | null;
  briefEnteredAt?: string | null;
  briefDueAt?: string | null;
  handedOffAt?: string | null;
  missingInfoDueAt?: string | null;
  handoffStatus?: string | null;
  solutionAcceptDueAt?: string | null;
  solutionClaimedAt?: string | null;
  solutionDueAt?: string | null;
  solutionRevisionDueAt?: string | null;
  solutionReleasedAt?: string | null;
  customerDueAt?: string | null;
  quoteAcceptDueAt?: string | null;
  quoteAcceptedAt?: string | null;
  quoteDueAt?: string | null;
  quoteSentBackAt?: string | null;
  quoteApprovedAt?: string | null;
  negotiateDueAt?: string | null;
  contractDueAt?: string | null;
  contractSignedAt?: string | null;
  workSettings?: SolutionWorkDueSettings;
}

function pickCurrent(clocks: HandoffSlaClock[], step: string | null | undefined): HandoffSlaClock | null {
  const active = clocks.filter((c) => c.state !== 'na');
  if (!active.length) return null;
  if (step) {
    const same = active.filter((c) => c.step_key === step);
    if (same.length) {
      const worst = same.find((c) => c.state === 'breach') ?? same.find((c) => c.state === 'warning') ?? same[0];
      return worst;
    }
  }
  return active.find((c) => c.state === 'breach') ?? active.find((c) => c.state === 'warning') ?? active[0];
}

export function buildHandoffSlaView(source: HandoffSlaSource, now = new Date()): HandoffSlaView {
  const clocks: HandoffSlaClock[] = [];
  const step = String(source.currentStep ?? '').trim() || null;
  const status = String(source.handoffStatus ?? '').trim();

  if (source.assignedAt && !source.claimedAt && !source.firstCallAt && (!step || step === 'intake')) {
    clocks.push(
      clockOf(
        'sales_accept',
        salesAcceptDueAt(new Date(source.assignedAt)),
        source.assignedAt,
        now,
        'Nhận lead trong 15 phút trong giờ; ngoài giờ hạn 08:30 ngày làm việc kế tiếp.',
      ),
    );
  }
  if (source.claimedAt && !source.firstCallAt && (!step || step === 'intake')) {
    clocks.push(
      clockOf(
        'sales_update',
        firstUpdateDueAt(new Date(source.claimedAt)),
        source.claimedAt,
        now,
        'Ghi cuộc gọi / cập nhật trong 1 giờ làm việc (08:30–18:30 T2–T6).',
      ),
    );
  }
  if (!source.handedOffAt && (source.briefDueAt || (step === 'sales_brief' && (source.briefEnteredAt || source.claimedAt)))) {
    const start = source.briefEnteredAt || source.claimedAt || source.assignedAt;
    const due = source.briefDueAt || (start ? briefSubmitDueAt(new Date(start)).toISOString() : null);
    clocks.push(
      clockOf(
        'sales_brief',
        due,
        start,
        now,
        'Submit to AM trong 1 ngày làm việc kể từ khi vào bước tư vấn & nhập Brief.',
      ),
    );
  }
  if (source.missingInfoDueAt && (status === 'returned' || status === 'returned_to_sales' || status === 'return')) {
    clocks.push(
      clockOf(
        'missing_info',
        source.missingInfoDueAt,
        source.missingInfoDueAt,
        now,
        'Bổ sung thông tin trong 1 giờ làm việc (08:30–18:30 T2–T6).',
      ),
    );
  }
  if (status === 'pending' && source.solutionAcceptDueAt) {
    clocks.push(
      clockOf(
        'solution_accept',
        source.solutionAcceptDueAt,
        source.handedOffAt,
        now,
        'AM nhận hoặc giao Marketing trong 15 phút trong giờ; ngoài giờ hạn 08:30 ngày làm việc kế.',
      ),
    );
  }
  if (status === 'with_solution' && source.solutionRevisionDueAt) {
    clocks.push(
      clockOf(
        'solution_revision',
        source.solutionRevisionDueAt,
        source.solutionRevisionDueAt,
        now,
        'Trả Solutions đã chỉnh trong 2 giờ.',
      ),
    );
  } else if (status === 'with_solution' && (source.solutionDueAt || source.solutionClaimedAt)) {
    const due =
      source.solutionDueAt ||
      (source.solutionClaimedAt
        ? solutionWorkDueAt(new Date(source.solutionClaimedAt), source.workSettings).toISOString()
        : null);
    clocks.push(
      clockOf(
        'solution_work',
        due,
        source.solutionClaimedAt,
        now,
        'Trước 15:30: 4 giờ làm việc. Sau 15:30 hoặc cuối tuần: 11:00 ngày làm việc kế tiếp.',
      ),
    );
  }
  if (status === 'released' && !source.quoteApprovedAt && source.customerDueAt) {
    clocks.push(
      clockOf(
        'customer_response',
        source.customerDueAt,
        source.solutionReleasedAt,
        now,
        'Sales lấy phản hồi khách trong 8 giờ sau khi nộp Solution.',
      ),
    );
  }
  if (source.quoteSentBackAt && !source.quoteApprovedAt && source.quoteSentBackAt) {
    clocks.push(
      clockOf(
        'ceo_approve',
        ceoApproveDueAt(new Date(source.quoteSentBackAt)),
        source.quoteSentBackAt,
        now,
        'CEO duyệt hoặc từ chối báo giá trong 24 giờ.',
      ),
    );
  } else if (source.quoteAcceptedAt && source.quoteDueAt && !source.quoteSentBackAt && !source.quoteApprovedAt) {
    clocks.push(
      clockOf(
        'quote_finish',
        source.quoteDueAt,
        source.quoteAcceptedAt,
        now,
        'AM lập báo giá trong 2 giờ làm việc (08:30–18:30 T2–T6).',
      ),
    );
  } else if (source.quoteAcceptDueAt && !source.quoteAcceptedAt && !source.quoteApprovedAt) {
    clocks.push(
      clockOf(
        'quote_accept',
        source.quoteAcceptDueAt,
        source.quoteAcceptDueAt,
        now,
        'AM nhận case báo giá trong 15 phút trong giờ; ngoài giờ hạn 08:30 ngày làm việc kế.',
      ),
    );
  }
  if (source.quoteApprovedAt && !source.contractSignedAt) {
    if (source.negotiateDueAt || step === 'negotiate' || step === 'dam_phan') {
      const due = source.negotiateDueAt || negotiateDueAt(new Date(source.quoteApprovedAt)).toISOString();
      clocks.push(
        clockOf('negotiate', due, source.quoteApprovedAt, now, 'Thương thảo trong 3 ngày làm việc sau khi CEO duyệt.'),
      );
    }
    if (source.contractDueAt || step === 'contract' || step === 'ky_hop_dong') {
      const due = source.contractDueAt || contractDueAt(new Date(source.quoteApprovedAt)).toISOString();
      clocks.push(
        clockOf('contract', due, source.quoteApprovedAt, now, 'Ký hợp đồng trong 5 ngày làm việc sau khi CEO duyệt.'),
      );
    }
  }

  return {
    policy: HANDOFF_SLA_POLICY,
    clocks,
    current: pickCurrent(clocks, step),
    suggested_solution_due_at: suggestedSolutionDueAt(now, source.workSettings).toISOString(),
  };
}

export function slaNotifyCopy(clock: HandoffSlaClock, leadId: number): { title: string; body: string } {
  const due = clock.due_label;
  const link = `/crm/leads/${leadId}`;
  if (clock.state === 'breach') {
    return {
      title: `SLA trễ — ${clock.label}`,
      body: `Lead #${leadId}: ${clock.label} đã quá hạn (hạn ${due}). ${clock.message} Mở lead: ${link}`,
    };
  }
  return {
    title: `SLA sắp trễ — ${clock.label}`,
    body: `Lead #${leadId}: ${clock.label} sắp đến hạn (hạn ${due}, ${clock.countdown}). ${clock.message} Mở lead: ${link}`,
  };
}
