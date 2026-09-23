import type { LeadRow } from '@/lib/api';
import { WORK_SIGNALS } from './work-signals';
import { normalizeLeadStatus } from './lead-status';

export type KanbanCardActionKind =
  | 'call'
  | 'care'
  | 'view_quote'
  | 'view_proposal'
  | 'view_contract'
  | 'return_am'
  | 'advance_proposal'
  | 'advance_contract'
  | 'mark_signed'
  | 'intake'
  | 'lead';

export type KanbanCardAction = {
  href?: string;
  label: string;
  kind: KanbanCardActionKind;
  /** Status patch when href is omitted (in-board action). */
  nextStatus?: string;
  auditNote?: string;
  primary?: boolean;
};

/** @deprecated Prefer kanbanCardActions — kept for older call sites. */
export type KanbanCardCta = {
  href: string;
  label: string;
  kind: 'call' | 'intake' | 'quote' | 'lead' | 'hub';
};

const EARLY: ReadonlySet<string> = new Set(['moi', 'da_lien_he', 'new']);
const CONSULT: ReadonlySet<string> = new Set(['dang_tu_van', 'hen_gap']);
const QUOTE: ReadonlySet<string> = new Set(['bao_gia']);
const PROPOSAL: ReadonlySet<string> = new Set(['proposal', 'dam_phan']);
const CONTRACT: ReadonlySet<string> = new Set(['won', 'chot']);

export const KANBAN_STAGE_SETS = {
  early: EARLY,
  consult: CONSULT,
  quote: new Set([...QUOTE, ...PROPOSAL]),
  won: CONTRACT,
};

export function kanbanStageAccent(status: string): string {
  const st = normalizeLeadStatus(status);
  if (CONSULT.has(st)) return WORK_SIGNALS.sky;
  if (QUOTE.has(st) || PROPOSAL.has(st)) return WORK_SIGNALS.gold;
  if (CONTRACT.has(st)) return WORK_SIGNALS.won;
  if (st === 'lost' || st === 'pending_cleanup') return WORK_SIGNALS.cold;
  return WORK_SIGNALS.ptt;
}

function digitsPhone(phone: string | undefined): string {
  return String(phone ?? '').replace(/[^\d+]/g, '');
}

/**
 * AE-oriented kanban actions by stage.
 * Quote / Proposal / HĐ: view + return + advance (no create — create is AM/CEO/GĐKD).
 */
export function kanbanCardActions(
  lead: Pick<LeadRow, 'id' | 'phone' | 'status' | 'ai_band' | 'sla_state'>,
): KanbanCardAction[] {
  const status = normalizeLeadStatus(lead.status);
  const phone = digitsPhone(lead.phone);
  const careHref = `/crm/leads/${lead.id}`;
  const dealHref = `/crm/leads/${lead.id}/deal-room`;

  if (EARLY.has(status)) {
    const actions: KanbanCardAction[] = [];
    if (phone) {
      actions.push({ href: `tel:${phone}`, label: 'Gọi ngay', kind: 'call', primary: true });
    }
    actions.push({ href: careHref, label: 'Chăm sóc', kind: 'care', primary: !phone });
    return actions;
  }

  if (CONSULT.has(status)) {
    return [
      { href: careHref, label: 'Chăm sóc', kind: 'care', primary: true },
      { href: `/crm/intake?lead_id=${lead.id}`, label: 'Intake', kind: 'intake' },
    ];
  }

  if (QUOTE.has(status)) {
    return [
      { href: dealHref, label: 'Xem báo giá', kind: 'view_quote', primary: true },
      {
        label: 'Trả lại AM',
        kind: 'return_am',
        nextStatus: 'dang_tu_van',
        auditNote: 'AE trả lại báo giá cho Account Manager để chỉnh sửa.',
      },
      {
        label: '→ Proposal',
        kind: 'advance_proposal',
        nextStatus: 'proposal',
        auditNote: 'AE xác nhận báo giá OK — chuyển sang Proposal.',
      },
    ];
  }

  if (PROPOSAL.has(status)) {
    return [
      { href: dealHref, label: 'Xem Proposal', kind: 'view_proposal', primary: true },
      {
        label: 'Trả lại AM/CEO',
        kind: 'return_am',
        nextStatus: 'bao_gia',
        auditNote: 'AE trả lại Proposal cho AM/CEO/GĐKD để chỉnh sửa.',
      },
      {
        label: '→ Tạo HĐ',
        kind: 'advance_contract',
        nextStatus: 'won',
        auditNote: 'AE xác nhận Proposal OK — chuyển sang tạo HĐ.',
      },
    ];
  }

  if (CONTRACT.has(status)) {
    if (status === 'chot') {
      return [{ href: `${careHref}#lead-contract`, label: 'Xem HĐ', kind: 'view_contract', primary: true }];
    }
    return [
      { href: `${careHref}#lead-contract`, label: 'Xem HĐ', kind: 'view_contract', primary: true },
      {
        label: 'Trả lại AM/CEO',
        kind: 'return_am',
        nextStatus: 'proposal',
        auditNote: 'AE trả lại HĐ cho AM/CEO/GĐKD để chỉnh sửa.',
      },
      {
        label: 'Đã ký HĐ',
        kind: 'mark_signed',
        nextStatus: 'chot',
        auditNote: 'AE xác nhận khách đã ký HĐ.',
      },
    ];
  }

  return [{ href: careHref, label: 'Mở lead', kind: 'lead', primary: true }];
}

/** Legacy single-CTA helper (first primary action). */
export function kanbanCardCta(
  lead: Pick<LeadRow, 'id' | 'phone' | 'status' | 'ai_band' | 'sla_state'>,
): KanbanCardCta {
  const first = kanbanCardActions(lead)[0];
  const href = first?.href ?? `/crm/leads/${lead.id}`;
  const label = first?.label ?? 'Mở lead';
  let kind: KanbanCardCta['kind'] = 'lead';
  if (first?.kind === 'call') kind = 'call';
  else if (first?.kind === 'intake') kind = 'intake';
  else if (first?.kind === 'view_quote' || first?.kind === 'view_proposal') kind = 'quote';
  else if (first?.kind === 'view_contract' || first?.kind === 'mark_signed') kind = 'hub';
  return { href, label, kind };
}
