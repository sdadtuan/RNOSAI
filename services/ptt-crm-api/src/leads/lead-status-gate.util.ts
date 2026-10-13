import {
  assertStatusAllowedForFlow,
  statusOptionsForFlowKind,
  type LeadFlowKind,
} from '../leads-funnel/lead-flow-kind.util';
import {
  presalesCareGateState,
} from '../leads-funnel/care-pipeline.util';
import { CONTACT_OK_CARE_STATUS } from '../leads-funnel/leads-funnel.types';

/** Status codes used on ops-web `/crm/leads/[id]`. */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_tu_van: 'Đang tư vấn',
  hen_gap: 'Hẹn gặp',
  bao_gia: 'Báo giá',
  dam_phan: 'Đàm phán',
  chot: 'Chốt',
  post_sale: 'Post-sale',
  won: 'Won (HĐ ký)',
  proposal: 'Proposal',
  lost: 'Thất bại',
  nurture: 'Chăm sóc lại',
  pending_cleanup: 'Chờ dọn',
  first_contact: 'Liên hệ lần đầu',
  new: 'Mới',
};

const B2B_KANBAN_MOVE_STATUSES = new Set([
  'moi',
  'da_lien_he',
  'dang_tu_van',
  'bao_gia',
  'proposal',
  'dam_phan',
  'won',
  'chot',
  'lost',
  'nurture',
]);

const QUOTED_STATUSES = new Set(['bao_gia', 'proposal', 'dam_phan']);

export const KANBAN_LOST_REASON_SEED: ReadonlyArray<{
  id: string;
  label: string;
  needs_note: boolean;
}> = [
  { id: 'no_need', label: 'Không nhu cầu', needs_note: false },
  { id: 'price', label: 'Giá', needs_note: false },
  { id: 'competitor', label: 'Đối thủ', needs_note: false },
  { id: 'wrong_number', label: 'Sai số', needs_note: false },
  { id: 'unreachable', label: 'Không liên lạc được', needs_note: false },
  { id: 'other', label: 'Khác', needs_note: true },
];

export const OUTREACH_ACTIVITY_TYPES = ['call', 'email', 'message', 'meeting'] as const;

export const TERMINAL_WON_STATUSES = ['chot', 'won', 'post_sale'] as const;

export const AUDIT_NOTE_REQUIRED_STATUSES = ['chot', 'won', 'post_sale', 'lost'] as const;

export const MIN_AUDIT_NOTE_LEN = 3;

/** §11 — allowed CRM status transitions (spa + B2B). */
export const LEAD_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  moi: ['da_lien_he', 'lost', 'pending_cleanup'],
  new: ['da_lien_he', 'lost', 'pending_cleanup'],
  first_contact: ['da_lien_he', 'lost', 'pending_cleanup'],
  da_lien_he: ['dang_tu_van', 'hen_gap', 'bao_gia', 'proposal', 'lost', 'pending_cleanup'],
  dang_tu_van: ['hen_gap', 'bao_gia', 'dam_phan', 'chot', 'won', 'lost'],
  hen_gap: ['chot', 'dang_tu_van', 'lost'],
  bao_gia: ['proposal', 'dam_phan', 'chot', 'won', 'lost', 'dang_tu_van'],
  dam_phan: ['chot', 'won', 'lost', 'bao_gia', 'proposal'],
  proposal: ['won', 'dam_phan', 'lost', 'bao_gia'],
  chot: ['post_sale', 'won', 'proposal'],
  won: ['chot', 'post_sale', 'proposal'],
  post_sale: [],
  lost: ['moi', 'pending_cleanup'],
  pending_cleanup: ['moi', 'da_lien_he', 'lost'],
};

const STATUS_ALIASES: Record<string, string> = {
  new: 'moi',
  contacted: 'da_lien_he',
  qualified: 'da_lien_he',
  first_contact: 'moi',
  intake: 'moi',
  qualify: 'da_lien_he',
  nurturing: 'dang_tu_van',
  negotiation: 'dam_phan',
};

export function normalizeLeadStatus(status: string | null | undefined): string {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'moi';
  return STATUS_ALIASES[raw] ?? raw;
}

export function leadStatusLabel(status: string): string {
  const key = normalizeLeadStatus(status);
  return LEAD_STATUS_LABELS[key] ?? LEAD_STATUS_LABELS[status] ?? status;
}

export function allowedNextStatuses(current: string | null | undefined): string[] {
  const st = normalizeLeadStatus(current);
  const next = LEAD_STATUS_TRANSITIONS[st] ?? [];
  return [...next];
}

export interface LeadStatusOptionRow {
  id: string;
  label: string;
}

export interface LeadStatusOptionsContext {
  currentStatus: string;
  flowKind: LeadFlowKind;
  b2Complete: boolean;
  hasOutreachActivity: boolean;
  needsCleanup: boolean;
  gateEnabled: boolean;
}

export function isCandidateStatusSelectable(
  ctx: LeadStatusOptionsContext,
  candidate: string,
): boolean {
  const current = normalizeLeadStatus(ctx.currentStatus);
  const next = normalizeLeadStatus(candidate);
  if (current === next) return true;

  if (!ctx.gateEnabled) {
    return statusOptionsForFlowKind(ctx.flowKind).includes(next);
  }

  try {
    assertStatusAllowedForFlow(ctx.flowKind, next);
  } catch {
    return false;
  }

  if (!isStatusTransitionAllowed(current, next, ctx.flowKind)) return false;

  if (ctx.needsCleanup && next !== 'pending_cleanup' && next !== 'lost') {
    return false;
  }

  const requiresB2 = (TERMINAL_WON_STATUSES as readonly string[]).includes(next);
  if (requiresB2 && (!ctx.b2Complete || !ctx.hasOutreachActivity)) {
    return false;
  }

  if (
    current === 'moi' &&
    !['lost', 'pending_cleanup'].includes(next) &&
    !ctx.hasOutreachActivity &&
    !ctx.b2Complete
  ) {
    return false;
  }

  return true;
}

export function collectStatusOptionHints(ctx: LeadStatusOptionsContext): string[] {
  const hints: string[] = [];
  const current = normalizeLeadStatus(ctx.currentStatus);

  if (ctx.needsCleanup) {
    hints.push('Lead thiếu dữ liệu — chỉ chuyển Chờ dọn / Lost hoặc hoàn thiện thông tin.');
  }

  if (
    current === 'moi' &&
    !ctx.hasOutreachActivity &&
    !ctx.b2Complete &&
    allowedNextStatuses(current).some(
      (s) => !['lost', 'pending_cleanup'].includes(s) && !isCandidateStatusSelectable(ctx, s),
    )
  ) {
    hints.push('Cần ghi activity liên hệ trước khi rời trạng thái Mới.');
  }

  const blockedTerminal = allowedNextStatuses(current).some(
    (s) =>
      (TERMINAL_WON_STATUSES as readonly string[]).includes(s) &&
      !isCandidateStatusSelectable(ctx, s),
  );
  if (blockedTerminal) {
    if (!ctx.b2Complete) {
      hints.push('Hoàn thành B2 (Liên hệ OK) trên Funnel trước khi chốt / won.');
    }
    if (!ctx.hasOutreachActivity) {
      hints.push('Cần activity liên hệ (Gọi / Tin nhắn / Họp) trước khi chốt / won.');
    }
  }

  return [...new Set(hints)];
}

export function computeAllowedNextStatuses(ctx: LeadStatusOptionsContext): {
  options: LeadStatusOptionRow[];
  hints: string[];
} {
  const current = normalizeLeadStatus(ctx.currentStatus);
  const hints = ctx.gateEnabled ? collectStatusOptionHints(ctx) : [];

  const candidates = ctx.gateEnabled
    ? ctx.flowKind === 'b2b_prospect'
      ? [...B2B_KANBAN_MOVE_STATUSES].filter((status) => status !== 'chot')
      : allowedNextStatuses(current)
    : [...statusOptionsForFlowKind(ctx.flowKind)];

  const seen = new Set<string>();
  const options: LeadStatusOptionRow[] = [];

  const pushOption = (id: string) => {
    const key = normalizeLeadStatus(id);
    if (seen.has(key)) return;
    if (!isCandidateStatusSelectable(ctx, key)) return;
    seen.add(key);
    options.push({ id: key, label: leadStatusLabel(key) });
  };

  pushOption(current);
  for (const candidate of candidates) {
    pushOption(candidate);
  }

  return { options, hints };
}

export function isStatusTransitionAllowed(
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
  flowKind?: 'spa_operational' | 'b2b_prospect',
): boolean {
  const old = normalizeLeadStatus(oldStatus);
  const next = normalizeLeadStatus(newStatus);
  if (old === next) return true;
  if (
    flowKind === 'b2b_prospect' &&
    B2B_KANBAN_MOVE_STATUSES.has(old) &&
    B2B_KANBAN_MOVE_STATUSES.has(next) &&
    next !== 'chot'
  ) {
    return true;
  }
  const allowed = LEAD_STATUS_TRANSITIONS[old];
  if (!allowed) return false;
  return allowed.includes(next);
}

export interface KanbanLostReason {
  id: string;
  label: string;
  needs_note: boolean;
}

export interface LeadStatusGateContext {
  oldStatus: string;
  newStatus: string;
  auditNote: string;
  allowOverride: boolean;
  overrideReason: string;
  b2Complete: boolean;
  hasOutreachActivity: boolean;
  needsCleanup: boolean;
  flowKind: 'spa_operational' | 'b2b_prospect';
  hasCallLog?: boolean;
  contactNote?: string;
  lostReason?: string;
  lostReasonNote?: string;
  nextCallAt?: string | null;
  hasQuote?: boolean;
  quoteValue?: number | null;
  lostReasons?: readonly KanbanLostReason[];
}

export class LeadStatusGateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LeadStatusGateError';
    this.code = code;
  }
}

export function validateLeadStatusChange(ctx: LeadStatusGateContext): void {
  const old = normalizeLeadStatus(ctx.oldStatus);
  const next = normalizeLeadStatus(ctx.newStatus);
  if (old === next) return;

  const auditLen = ctx.auditNote.trim().length;
  const b2bLost = ctx.flowKind === 'b2b_prospect' && next === 'lost';
  if (
    !b2bLost &&
    (AUDIT_NOTE_REQUIRED_STATUSES as readonly string[]).includes(next) &&
    auditLen < MIN_AUDIT_NOTE_LEN
  ) {
    throw new LeadStatusGateError(
      'audit_note_required',
      `Cần ghi audit note ≥ ${MIN_AUDIT_NOTE_LEN} ký tự khi chốt / won / lost.`,
    );
  }

  if (ctx.allowOverride) {
    if (ctx.overrideReason.trim().length < MIN_AUDIT_NOTE_LEN) {
      throw new LeadStatusGateError(
        'override_reason_required',
        `Override trạng thái cần lý do ≥ ${MIN_AUDIT_NOTE_LEN} ký tự.`,
      );
    }
    return;
  }

  try {
    assertStatusAllowedForFlow(ctx.flowKind, next);
  } catch (err) {
    throw new LeadStatusGateError(
      'flow_status_mismatch',
      err instanceof Error ? err.message : 'Trạng thái không thuộc luồng lead.',
    );
  }

  if (!isStatusTransitionAllowed(old, next, ctx.flowKind)) {
    throw new LeadStatusGateError(
      'invalid_transition',
      `Không được chuyển từ «${leadStatusLabel(old)}» sang «${leadStatusLabel(next)}».`,
    );
  }

  if (
    ctx.needsCleanup &&
    next !== 'pending_cleanup' &&
    next !== 'lost'
  ) {
    throw new LeadStatusGateError(
      'needs_cleanup',
      'Lead thiếu dữ liệu bắt buộc — hoàn thiện thông tin hoặc chuyển Chờ dọn / Lost.',
    );
  }

  const requiresB2 = (TERMINAL_WON_STATUSES as readonly string[]).includes(next);
  if (requiresB2 && !ctx.b2Complete) {
    throw new LeadStatusGateError(
      'b2_incomplete',
      'Hoàn thành B2 (Liên hệ OK) trên Funnel trước khi chốt / won.',
    );
  }

  if (requiresB2 && !ctx.hasOutreachActivity) {
    throw new LeadStatusGateError(
      'outreach_required',
      'Cần activity liên hệ (Gọi điện / Tin nhắn / Họp) trước khi chốt / won.',
    );
  }

  const notedContact = String(ctx.contactNote ?? '').trim().length >= MIN_AUDIT_NOTE_LEN;
  const hasContact = ctx.hasOutreachActivity || Boolean(ctx.hasCallLog) || notedContact;
  if (
    old === 'moi' &&
    next === 'da_lien_he' &&
    !hasContact &&
    !ctx.b2Complete
  ) {
    throw new LeadStatusGateError(
      'outreach_required',
      'Cần activity liên hệ (cuộc gọi hoặc ghi chú) trước khi sang Đã liên hệ.',
    );
  }

  if (
    old === 'moi' &&
    !['lost', 'pending_cleanup', 'da_lien_he'].includes(next) &&
    !hasContact &&
    !ctx.b2Complete
  ) {
    throw new LeadStatusGateError(
      'outreach_required',
      'Cần ghi activity liên hệ trước khi rời trạng thái Mới.',
    );
  }

  if (ctx.flowKind === 'b2b_prospect' && QUOTED_STATUSES.has(next)) {
    const value = Number(ctx.quoteValue);
    if (!ctx.hasQuote || !Number.isFinite(value) || value <= 0) {
      throw new LeadStatusGateError(
        'quote_required',
        'Sang Báo giá cần đính kèm báo giá (file hoặc link) và giá trị.',
      );
    }
  }

  if (ctx.flowKind === 'b2b_prospect' && next === 'lost') {
    const catalog = ctx.lostReasons?.length ? ctx.lostReasons : KANBAN_LOST_REASON_SEED;
    const reason = catalog.find((row) => row.id === String(ctx.lostReason ?? '').trim());
    if (!reason) {
      throw new LeadStatusGateError('lost_reason_required', 'Chọn lý do thất bại.');
    }
    const note = String(ctx.lostReasonNote ?? ctx.auditNote ?? '').trim();
    if (reason.needs_note && note.length < MIN_AUDIT_NOTE_LEN) {
      throw new LeadStatusGateError('lost_reason_note_required', 'Lý do Khác cần ghi chú.');
    }
  }

  if (ctx.flowKind === 'b2b_prospect' && next === 'nurture') {
    const at = Date.parse(String(ctx.nextCallAt ?? ''));
    if (!Number.isFinite(at)) {
      throw new LeadStatusGateError('callback_required', 'Chăm sóc lại cần ngày hẹn gọi lại.');
    }
  }
}

export function computeB2Complete(input: {
  careStageCurrent: string | null | undefined;
  careStagesDoneJson: string | null | undefined;
  hasContactOkReport: boolean;
}): boolean {
  const gate = presalesCareGateState(input.careStageCurrent, input.careStagesDoneJson);
  return gate.complete || input.hasContactOkReport;
}

export function kanbanLostReasonsFromPayload(raw: unknown): KanbanLostReason[] {
  const seed = KANBAN_LOST_REASON_SEED.map((row) => ({ ...row }));
  if (!raw || typeof raw !== 'object') return seed;
  const kanban = (raw as Record<string, unknown>).kanban;
  if (!kanban || typeof kanban !== 'object') return seed;
  const list = (kanban as Record<string, unknown>).lost_reasons;
  if (!Array.isArray(list) || list.length === 0) return seed;
  const parsed: KanbanLostReason[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    const label = String(item.label ?? '').trim();
    if (!id || !label) continue;
    parsed.push({ id, label, needs_note: Boolean(item.needs_note) });
  }
  return parsed.length > 0 ? parsed : seed;
}

export { CONTACT_OK_CARE_STATUS };
