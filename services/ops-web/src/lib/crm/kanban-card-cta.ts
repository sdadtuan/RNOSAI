import type { LeadRow } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import { isAccountExecutive, isAccountManager, isMarketingLeader } from './lead-ae-visibility';
import { WORK_SIGNALS } from './work-signals';
import { leadHasSubmittedSolution, normalizeLeadStatus } from './lead-status';

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
  /** Shown instead of a status move. The control is not an action. */
  blockedReason?: string;
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
function missingRecord(flag: boolean | null | undefined): boolean {
  return flag === false;
}

type QuoteProgressLead = Pick<
  LeadRow,
  | 'has_quote'
  | 'quote_sheet_saved'
  | 'quote_sent_to_sale'
  | 'quote_approved'
  | 'quote_case_open'
  | 'solution_handoff'
  | 'has_contract'
>;

/**
 * Quote-sheet / quote-case state. crm_proposals (`has_quote`) is only the legacy file.
 * No sheet → Chưa có báo giá. Saved → Đã có báo giá. Sent → Đã gửi Sale.
 * Approved quote waits for a closed contract and GDKD approval before Triển Khai.
 * Null means the caller has no quote-case fields and should keep the legacy label.
 */
export function quoteProgressLabel(lead: QuoteProgressLead): string | null {
  if (lead.quote_approved) return 'Chờ GĐKD duyệt HĐ';
  if (lead.quote_sent_to_sale) return 'Đã gửi Sale';
  if (lead.quote_sheet_saved) return 'Đã có báo giá';
  if (lead.has_quote === false) return 'Chưa có báo giá';
  return null;
}

function quoteLeadAction(lead: QuoteProgressLead, careHref: string, legacy: KanbanCardAction): KanbanCardAction {
  const label = quoteProgressLabel(lead);
  if (!label) return legacy;
  if (label === 'Chưa có báo giá') {
    return { href: careHref, label, kind: 'lead', primary: true };
  }
  return { href: careHref, label, kind: 'view_quote', primary: true };
}

function quoteSignalsKnown(lead: QuoteProgressLead): boolean {
  return (
    lead.solution_handoff !== undefined ||
    lead.quote_sheet_saved !== undefined ||
    lead.quote_sent_to_sale !== undefined ||
    lead.quote_approved !== undefined ||
    lead.has_quote !== undefined
  );
}

/** Proposal / đàm phán stays in this column. It is blocked until Sale has the quote. */
function advanceProposalAction(lead: QuoteProgressLead): KanbanCardAction {
  if (quoteSignalsKnown(lead) && !leadHasSubmittedSolution(lead)) {
    return {
      label: 'Chưa có Solution',
      kind: 'advance_proposal',
      blockedReason: 'Chưa có Solution đã nộp.',
    };
  }
  const waitingOnSale =
    lead.quote_case_open === true && lead.quote_sent_to_sale !== true && lead.quote_approved !== true;
  if (waitingOnSale) {
    return {
      label: 'Sale chưa nhận báo giá',
      kind: 'advance_proposal',
      blockedReason: 'Sale chưa nhận báo giá.',
    };
  }
  return {
    label: '→ Proposal',
    kind: 'advance_proposal',
    nextStatus: 'proposal',
    auditNote: 'AE xác nhận báo giá OK — chuyển sang Proposal.',
  };
}

/** Tạo HĐ needs a submitted Solution and a quote Sale has approved. */
function advanceContractAction(lead: QuoteProgressLead): KanbanCardAction {
  if (quoteSignalsKnown(lead) && !leadHasSubmittedSolution(lead)) {
    return {
      label: 'Chưa có Solution',
      kind: 'advance_contract',
      blockedReason: 'Chưa có Solution đã nộp.',
    };
  }
  const quoteKnown =
    lead.quote_sheet_saved !== undefined ||
    lead.quote_sent_to_sale !== undefined ||
    lead.quote_approved !== undefined ||
    lead.has_quote !== undefined;
  if (
    quoteKnown &&
    !lead.quote_sheet_saved &&
    !lead.quote_sent_to_sale &&
    !lead.quote_approved &&
    lead.has_quote !== true
  ) {
    return {
      label: 'Chưa có báo giá',
      kind: 'advance_contract',
      blockedReason: 'Chưa có báo giá.',
    };
  }
  if (quoteKnown && lead.quote_approved !== true) {
    return {
      label: 'Sale chưa duyệt báo giá',
      kind: 'advance_contract',
      blockedReason: 'Sale chưa duyệt báo giá.',
    };
  }
  return {
    label: '→ Tạo HĐ',
    kind: 'advance_contract',
    blockedReason: 'Lập hợp đồng trên lead. GĐKD duyệt xong thì lead sang Triển Khai.',
  };
}

/** Sale steps on a card: care, intake, call, Trả lại AM, advance, mark signed. */
const SALE_ONLY_KINDS = new Set<KanbanCardActionKind>([
  'call',
  'care',
  'intake',
  'return_am',
  'advance_proposal',
  'advance_contract',
  'mark_signed',
]);

export type KanbanActionViewer = {
  staffId?: number | null;
  positionCode?: string | null;
};

/** The AE who owns this lead. AM and Marketing Leader are not that Sale. */
export function kanbanViewerIsAssignedSale(
  viewer: KanbanActionViewer | null | undefined,
  ownerId: number | null | undefined,
): boolean {
  if (!viewer) return false;
  const user = { position_code: viewer.positionCode ?? '' } as StoredStaffUser;
  if (isAccountManager(user) || isMarketingLeader(user) || !isAccountExecutive(user)) return false;
  const me = Number(viewer.staffId);
  const owner = Number(ownerId);
  return Number.isInteger(me) && me > 0 && me === owner;
}

export function kanbanCardActions(
  lead: Pick<
    LeadRow,
    | 'id'
    | 'owner_id'
    | 'phone'
    | 'status'
    | 'ai_band'
    | 'sla_state'
    | 'has_quote'
    | 'has_contract'
    | 'quote_sheet_saved'
    | 'quote_sent_to_sale'
    | 'quote_approved'
    | 'quote_case_open'
    | 'solution_handoff'
    | 'has_contract'
  >,
  viewer?: KanbanActionViewer | null,
): KanbanCardAction[] {
  const status = normalizeLeadStatus(lead.status);
  const phone = digitsPhone(lead.phone);
  const careHref = `/crm/leads/${lead.id}`;
  const dealHref = `/crm/leads/${lead.id}/deal-room`;
  const contractHref = `${careHref}?tab=contract#lead-contract`;

  let actions: KanbanCardAction[];
  if (EARLY.has(status)) {
    actions = [];
    if (phone) {
      actions.push({ href: `tel:${phone}`, label: 'Gọi ngay', kind: 'call', primary: true });
    }
    actions.push({ href: careHref, label: 'Chăm sóc', kind: 'care', primary: !phone });
  } else if (CONSULT.has(status)) {
    actions = [
      { href: careHref, label: 'Chăm sóc', kind: 'care', primary: true },
      { href: `/crm/intake?lead_id=${lead.id}`, label: 'Intake', kind: 'intake' },
    ];
  } else if (QUOTE.has(status)) {
    actions = [
      quoteLeadAction(lead, careHref, {
        href: careHref,
        label: 'Xem báo giá',
        kind: 'view_quote',
        primary: true,
      }),
      {
        label: 'Trả lại AM',
        kind: 'return_am',
        nextStatus: 'dang_tu_van',
        auditNote: 'AE trả lại báo giá cho Account Manager để chỉnh sửa.',
      },
      advanceProposalAction(lead),
    ];
  } else if (PROPOSAL.has(status)) {
    actions = [
      quoteLeadAction(lead, careHref, {
        href: dealHref,
        label: 'Xem Proposal',
        kind: 'view_proposal',
        primary: true,
      }),
      {
        label: 'Trả lại AM/CEO',
        kind: 'return_am',
        nextStatus: 'bao_gia',
        auditNote: 'AE trả lại Proposal cho AM/CEO/GĐKD để chỉnh sửa.',
      },
      advanceContractAction(lead),
    ];
  } else if (CONTRACT.has(status)) {
    const viewContract: KanbanCardAction = missingRecord(lead.has_contract)
      ? { href: careHref, label: 'Chưa có HĐ', kind: 'lead', primary: true }
      : { href: contractHref, label: 'Xem HĐ', kind: 'view_contract', primary: true };
    actions =
      status === 'chot'
        ? [viewContract]
        : [
            viewContract,
            {
              label: 'Trả lại AM/CEO',
              kind: 'return_am',
              nextStatus: 'proposal',
              auditNote: 'AE trả lại HĐ cho AM/CEO/GĐKD để chỉnh sửa.',
            },
            lead.has_contract === false
              ? {
                  label: 'Chưa có HĐ',
                  kind: 'mark_signed',
                  blockedReason: 'Chưa có hợp đồng để xác nhận đã ký.',
                }
              : {
                  label: 'Đã ký HĐ',
                  kind: 'mark_signed',
                  nextStatus: 'chot',
                  auditNote: 'AE xác nhận khách đã ký HĐ.',
                },
          ];
  } else {
    actions = [{ href: careHref, label: 'Mở lead', kind: 'lead', primary: true }];
  }
  return filterKanbanActions(actions, lead.owner_id, viewer);
}

function filterKanbanActions(
  actions: KanbanCardAction[],
  ownerId: number | null | undefined,
  viewer?: KanbanActionViewer | null,
): KanbanCardAction[] {
  if (!viewer) return actions;
  if (kanbanViewerIsAssignedSale(viewer, ownerId)) return actions;
  return actions.filter((action) => !SALE_ONLY_KINDS.has(action.kind));
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
