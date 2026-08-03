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
  lost: 'Lost',
  pending_cleanup: 'Chờ dọn',
  first_contact: 'Liên hệ lần đầu',
  new: 'Mới',
};

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
  bao_gia: ['dam_phan', 'chot', 'won', 'lost', 'dang_tu_van'],
  dam_phan: ['chot', 'won', 'lost', 'bao_gia'],
  proposal: ['dam_phan', 'won', 'lost', 'bao_gia'],
  chot: ['post_sale'],
  won: ['post_sale'],
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

export function isStatusTransitionAllowed(
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
): boolean {
  const old = normalizeLeadStatus(oldStatus);
  const next = normalizeLeadStatus(newStatus);
  if (old === next) return true;
  const allowed = LEAD_STATUS_TRANSITIONS[old];
  if (!allowed) return false;
  return allowed.includes(next);
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
  if (
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

  if (!isStatusTransitionAllowed(old, next)) {
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

  if (
    old === 'moi' &&
    !['lost', 'pending_cleanup'].includes(next) &&
    !ctx.hasOutreachActivity &&
    !ctx.b2Complete
  ) {
    throw new LeadStatusGateError(
      'outreach_required',
      'Cần ghi activity liên hệ trước khi rời trạng thái Mới.',
    );
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

export { CONTACT_OK_CARE_STATUS };
