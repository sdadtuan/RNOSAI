/**
 * Canonical 7-step handoff SLA (Tú approved 14/11/2026).
 * Calendar: from the Admin "Lead First Response SLA" config (Sales clocks use Sale dịch vụ,
 * Solution clocks use Marketing); T2–T6 08:30–18:30 Asia/Saigon when the config is missing.
 */
import {
  acceptDueAt,
  addBusinessDays,
  addBusinessHours,
  businessCalendar,
  businessCalendarLabel,
  formatClockMinutes,
  type BusinessCalendar,
  ictParts,
  isWeekend,
  nextWorkingDayAt,
  parseClockMinutes,
} from './business-hours.util';
import { solutionWorkDueAt, solutionWorkRuleText, type SolutionWorkDueSettings } from './solution-case.util';

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
  solution_accept: { step: 'await_solution', label: 'Hạn AM nhận / làm Solution', role: 'AM' },
  solution_work: { step: 'doing_solution', label: 'Hạn AM làm Solution', role: 'AM' },
  solution_revision: { step: 'doing_solution', label: 'Hạn chỉnh Solutions', role: 'AM' },
  customer_response: { step: 'await_quote', label: 'Hạn phản hồi khách', role: 'Sales' },
  quote_accept: { step: 'await_quote', label: 'Hạn AM nhận case báo giá', role: 'AM' },
  quote_finish: { step: 'await_quote', label: 'Hạn lập báo giá', role: 'AM' },
  ceo_approve: { step: 'negotiate', label: 'Hạn CEO duyệt', role: 'CEO' },
  negotiate: { step: 'negotiate', label: 'Hạn CEO duyệt', role: 'AM' },
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
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hh = get('hour');
  const mm = get('minute');
  const day = get('day');
  const month = get('month');
  const year = get('year');
  if (!hh || !mm || !day || !month || !year) return '—';
  return `${hh}:${mm} ${day}/${month}/${year}`;
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

export function suggestedSolutionDueAt(
  now = new Date(),
  rawSettings?: SolutionWorkDueSettings,
  cal: BusinessCalendar = businessCalendar('marketing'),
): Date {
  return solutionWorkDueAt(now, rawSettings, cal);
}

export function briefSubmitDueAt(startedAt: Date, cal: BusinessCalendar = businessCalendar('sale_service')): Date {
  return addBusinessDays(startedAt, HANDOFF_SLA_POLICY.briefBusinessDays, cal);
}

export function negotiateDueAt(approvedAt: Date, cal: BusinessCalendar = businessCalendar('sale_service')): Date {
  return addBusinessDays(approvedAt, HANDOFF_SLA_POLICY.negotiateBusinessDays, cal);
}

export function contractDueAt(approvedAt: Date, cal: BusinessCalendar = businessCalendar('sale_service')): Date {
  return addBusinessDays(approvedAt, HANDOFF_SLA_POLICY.contractBusinessDays, cal);
}

/** Customer response: 8 business hours (Sale dịch vụ calendar) after the Solution is released. */
export function customerResponseDueAt(
  releasedAt: Date,
  cal: BusinessCalendar = businessCalendar('sale_service'),
): Date {
  return addBusinessHours(releasedAt, HANDOFF_SLA_POLICY.customerResponseHours, cal);
}

/** Solution revision: "Hạn sửa Solutions (giờ)" (default 2) business hours after Sales asks for edits. */
export function revisionDueAt(
  from: Date,
  hours: number = HANDOFF_SLA_POLICY.revisionHours,
  cal: BusinessCalendar = businessCalendar('marketing'),
): Date {
  const h = Number(hours);
  return addBusinessHours(from, Number.isFinite(h) && h > 0 ? h : HANDOFF_SLA_POLICY.revisionHours, cal);
}

/** CEO quote approval: 24 business hours (system calendar) after the AM submits the quote. */
export function ceoApproveDueAt(submittedAt: Date, cal: BusinessCalendar = businessCalendar()): Date {
  return addBusinessHours(submittedAt, HANDOFF_SLA_POLICY.ceoApproveHours, cal);
}

export function salesAcceptDueAt(assignedAt: Date, cal: BusinessCalendar = businessCalendar('sale_service')): Date {
  return acceptDueAt(assignedAt, HANDOFF_SLA_POLICY.salesAcceptMinutes, cal);
}

export function firstUpdateDueAt(claimedAt: Date, cal: BusinessCalendar = businessCalendar('sale_service')): Date {
  return addBusinessHours(claimedAt, HANDOFF_SLA_POLICY.firstUpdateHours, cal);
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
  /** When the quote case was offered to the AM (start of the quote_accept clock). */
  quoteOfferedAt?: string | null;
  quoteAcceptedAt?: string | null;
  quoteDueAt?: string | null;
  quoteSentBackAt?: string | null;
  quoteApprovedAt?: string | null;
  negotiateDueAt?: string | null;
  contractDueAt?: string | null;
  contractSignedAt?: string | null;
  leadStatus?: string | null;
  contractCreatedAt?: string | null;
  implementationStatus?: string | null;
  workSettings?: SolutionWorkDueSettings;
}

const CONTRACT_STATUSES = new Set(['chot', 'won', 'post_sale', 'ky_hop_dong']);
const NEGOTIATE_STATUSES = new Set(['dam_phan', 'negotiation']);

/** Infer the SLA step_key used by pickCurrent / clock gating. */
export function inferHandoffSlaStep(input: {
  currentStep?: string | null;
  leadStatus?: string | null;
  handoffStatus?: string | null;
  quoteApprovedAt?: string | null;
  quoteSentBackAt?: string | null;
  contractSignedAt?: string | null;
  contractCreatedAt?: string | null;
  implementationStatus?: string | null;
}): string | null {
  const status = String(input.leadStatus ?? '').trim().toLowerCase();
  const handoff = String(input.handoffStatus ?? '').trim().toLowerCase();
  const impl = String(input.implementationStatus ?? '').trim().toLowerCase();
  if (input.contractSignedAt || CONTRACT_STATUSES.has(status) || impl === 'trien_khai') return 'contract';
  if (
    input.quoteApprovedAt ||
    input.contractCreatedAt ||
    impl === 'hop_dong' ||
    impl === 'ky_hop_dong' ||
    impl === 'sign_contract'
  ) {
    return 'contract';
  }
  const given = String(input.currentStep ?? '').trim();
  if (given) return given;
  if (input.quoteSentBackAt) return 'negotiate';
  if (NEGOTIATE_STATUSES.has(status)) return 'negotiate';
  if (status === 'bao_gia' || status === 'proposal' || handoff === 'released') return 'await_quote';
  if (handoff === 'with_solution') return 'doing_solution';
  if (handoff === 'pending') return 'await_solution';
  if (status === 'da_lien_he' || status === 'dang_tu_van') return 'sales_brief';
  if (status) return 'intake';
  return null;
}

function isContractStep(step: string | null | undefined, leadStatus?: string | null): boolean {
  const s = String(step ?? '').trim();
  const status = String(leadStatus ?? '').trim().toLowerCase();
  return (
    s === 'contract' ||
    s === 'sign_contract' ||
    s === 'ky_hop_dong' ||
    CONTRACT_STATUSES.has(status)
  );
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
  // Clock copy follows the loaded calendars / Solution settings (no hard-coded hours).
  const saleCal = businessCalendar('sale_service');
  const mktCal = businessCalendar('marketing');
  const sysCal = businessCalendar();
  const saleHours = businessCalendarLabel(saleCal);
  const mktHours = businessCalendarLabel(mktCal);
  const sysHours = businessCalendarLabel(sysCal);
  const workRule = solutionWorkRuleText(source.workSettings);
  const revisionHours =
    Number(source.workSettings?.revisionHours) > 0
      ? Number(source.workSettings?.revisionHours)
      : HANDOFF_SLA_POLICY.revisionHours;

  if (source.assignedAt && !source.claimedAt && !source.firstCallAt && (!step || step === 'intake')) {
    clocks.push(
      clockOf(
        'sales_accept',
        salesAcceptDueAt(new Date(source.assignedAt)),
        source.assignedAt,
        now,
        `Nhận lead trong ${HANDOFF_SLA_POLICY.salesAcceptMinutes} phút trong giờ; ngoài giờ hạn ${formatClockMinutes(saleCal.startMin)} ngày làm việc kế tiếp.`,
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
        `Ghi cuộc gọi / cập nhật trong ${HANDOFF_SLA_POLICY.firstUpdateHours} giờ làm việc (${saleHours}).`,
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
        null,
        now,
        `Bổ sung thông tin trong ${HANDOFF_SLA_POLICY.missingInfoHours} giờ làm việc (${saleHours}).`,
      ),
    );
  }
  if (status === 'pending' && source.solutionAcceptDueAt && !source.solutionDueAt) {
    clocks.push(
      clockOf(
        'solution_accept',
        source.solutionAcceptDueAt,
        source.handedOffAt,
        now,
        `AM nhận và làm Solution trong ${HANDOFF_SLA_POLICY.solutionAcceptMinutes} phút trong giờ; ngoài giờ hạn ${formatClockMinutes(mktCal.startMin)} ngày làm việc kế.`,
      ),
    );
  }
  if (status === 'pending' && source.solutionDueAt) {
    clocks.push(
      clockOf(
        'solution_work',
        source.solutionDueAt,
        source.handedOffAt,
        now,
        workRule,
      ),
    );
  }
  if (status === 'with_solution' && source.solutionRevisionDueAt) {
    clocks.push(
      clockOf(
        'solution_revision',
        source.solutionRevisionDueAt,
        null,
        now,
        `Trả Solutions đã chỉnh trong ${revisionHours} giờ làm việc (${mktHours}).`,
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
        workRule,
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
        `Sales lấy phản hồi khách trong ${HANDOFF_SLA_POLICY.customerResponseHours} giờ làm việc (${saleHours}) sau khi nộp Solution.`,
      ),
    );
  }
  if (source.quoteSentBackAt && !source.quoteApprovedAt) {
    clocks.push(
      clockOf(
        'ceo_approve',
        ceoApproveDueAt(new Date(source.quoteSentBackAt)),
        source.quoteSentBackAt,
        now,
        `CEO duyệt hoặc từ chối báo giá trong ${HANDOFF_SLA_POLICY.ceoApproveHours} giờ làm việc (${sysHours}).`,
      ),
    );
  } else if (source.quoteAcceptedAt && source.quoteDueAt && !source.quoteSentBackAt && !source.quoteApprovedAt) {
    clocks.push(
      clockOf(
        'quote_finish',
        source.quoteDueAt,
        source.quoteAcceptedAt,
        now,
        `AM lập báo giá trong 2 giờ làm việc (${sysHours}).`,
      ),
    );
  } else if (source.quoteAcceptDueAt && !source.quoteAcceptedAt && !source.quoteApprovedAt) {
    clocks.push(
      clockOf(
        'quote_accept',
        source.quoteAcceptDueAt,
        source.quoteOfferedAt ?? null,
        now,
        `AM nhận case báo giá trong 15 phút trong giờ; ngoài giờ hạn ${formatClockMinutes(sysCal.startMin)} ngày làm việc kế.`,
      ),
    );
  }
  if (source.quoteApprovedAt && !source.contractSignedAt) {
    const approved = new Date(source.quoteApprovedAt);
    const inferred = inferHandoffSlaStep({
      currentStep: step,
      leadStatus: source.leadStatus,
      handoffStatus: source.handoffStatus,
      quoteApprovedAt: source.quoteApprovedAt,
      quoteSentBackAt: source.quoteSentBackAt,
      contractSignedAt: source.contractSignedAt,
      contractCreatedAt: source.contractCreatedAt,
      implementationStatus: source.implementationStatus,
    });
    const atContract =
      isContractStep(inferred, source.leadStatus) ||
      Boolean(source.quoteApprovedAt) ||
      Boolean(source.contractCreatedAt);
    if (!atContract) {
      const due = source.negotiateDueAt || negotiateDueAt(approved).toISOString();
      clocks.push(
        clockOf('negotiate', due, source.quoteApprovedAt, now, 'CEO duyệt báo giá trong hạn đã giao.'),
      );
    }
    const contractDue = source.contractDueAt || contractDueAt(approved).toISOString();
    clocks.push(
      clockOf('contract', contractDue, source.quoteApprovedAt, now, 'Ký hợp đồng trong 5 ngày làm việc sau khi CEO duyệt.'),
    );
  }

  const resolvedStep = inferHandoffSlaStep({
    currentStep: step,
    leadStatus: source.leadStatus,
    handoffStatus: source.handoffStatus,
    quoteApprovedAt: source.quoteApprovedAt,
    quoteSentBackAt: source.quoteSentBackAt,
    contractSignedAt: source.contractSignedAt,
    contractCreatedAt: source.contractCreatedAt,
    implementationStatus: source.implementationStatus,
  });
  return {
    policy: HANDOFF_SLA_POLICY,
    clocks,
    current: pickCurrent(clocks, resolvedStep),
    suggested_solution_due_at: suggestedSolutionDueAt(now, source.workSettings).toISOString(),
  };
}

export function slaNotifyCopy(clock: HandoffSlaClock, leadId: number): { title: string; body: string } {
  const due = clock.due_label;
  if (clock.state === 'breach') {
    return {
      title: `SLA trễ — ${clock.label}`,
      body: `Lead #${leadId}: ${clock.label} đã quá hạn (hạn ${due}). ${clock.message}`.trim(),
    };
  }
  return {
    title: `SLA sắp trễ — ${clock.label}`,
    body: `Lead #${leadId}: ${clock.label} sắp đến hạn (hạn ${due}, ${clock.countdown}). ${clock.message}`.trim(),
  };
}


export type HandoffSlaRecipientInput = {
  role: HandoffSlaRole;
  clockKey: HandoffSlaClockKey;
  ownerId?: number | null;
  quoteAssigneeStaffId?: number | null;
  lastSolutionOwnerStaffId?: number | null;
  solutionOwnerStaffId?: number | null;
  amDeskStaffIds?: number[] | null;
  ceoDeskStaffIds?: number[] | null;
  superAdminStaffIds?: number[] | null;
};

function pushStaffId(ids: Set<number>, raw: unknown): void {
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) ids.add(n);
}

function assignedAmIds(input: HandoffSlaRecipientInput): number[] {
  const ids = new Set<number>();
  pushStaffId(ids, input.quoteAssigneeStaffId);
  pushStaffId(ids, input.solutionOwnerStaffId);
  pushStaffId(ids, input.lastSolutionOwnerStaffId);
  return [...ids];
}

function assignedMarketingIds(input: HandoffSlaRecipientInput): number[] {
  const ids = new Set<number>();
  pushStaffId(ids, input.solutionOwnerStaffId);
  pushStaffId(ids, input.lastSolutionOwnerStaffId);
  return [...ids];
}

/** Map a clock to notify recipients. Unclaimed AM / unowned Marketing clocks use the AM desk pool (ACM + SUPER-ADMIN). */
export function resolveHandoffSlaRecipientIds(input: HandoffSlaRecipientInput): number[] {
  const desk = [...new Set((input.amDeskStaffIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
  const ceoDesk = [...new Set((input.ceoDeskStaffIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
  if (input.role === 'Sales') {
    const ids = new Set<number>();
    pushStaffId(ids, input.ownerId);
    return [...ids];
  }
  if (input.role === 'CEO') return ceoDesk;
  if (input.role === 'Marketing') {
    const owned = assignedMarketingIds(input);
    return owned.length ? owned : desk;
  }
  // Negotiate / contract: AM owner plus SUPER-ADMIN. Unowned falls back to the AM desk pool.
  if (input.clockKey === 'negotiate' || input.clockKey === 'contract') {
    const ids = new Set<number>();
    for (const id of assignedAmIds(input)) ids.add(id);
    for (const id of input.superAdminStaffIds ?? []) pushStaffId(ids, id);
    if (!ids.size) {
      for (const id of desk) ids.add(id);
    }
    return [...ids];
  }
  // AM — unclaimed / pending accept (and any AM clock without an assignee) goes to the AM desk pool.
  const assigned = assignedAmIds(input);
  return assigned.length ? assigned : desk;
}
