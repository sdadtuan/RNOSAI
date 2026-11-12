import type { FunnelPrimaryAction } from '@/lib/crm/funnel-stepper.types';

/** In-page, read-only quote sheet on the lead detail (never /crm/proposals/new). */
export const LEAD_QUOTE_SHEET_HASH = '#lead-quote-sheet';

const PROPOSALS_NEW = /\/crm\/proposals\/new(?:\?|$)/i;
const OPEN_QUOTE_LABEL = /mở\s*báo\s*giá/i;

export function isProposalsNewHref(href: string | null | undefined): boolean {
  return Boolean(href && PROPOSALS_NEW.test(href));
}

/**
 * Where the "Mở báo giá" control should go.
 * Sales must never be sent to /crm/proposals/new (403). If the in-page
 * approved / viewable sheet is on the lead, scroll there; otherwise hide.
 */
export function resolveLeadQuoteOpenHref(input: {
  isSales: boolean;
  quoteSheetVisible: boolean;
  existingProposalHref?: string | null;
}): string | null {
  if (input.isSales) {
    return input.quoteSheetVisible ? LEAD_QUOTE_SHEET_HASH : null;
  }
  const href = (input.existingProposalHref ?? '').trim();
  if (href && !isProposalsNewHref(href)) return href;
  if (input.quoteSheetVisible) return LEAD_QUOTE_SHEET_HASH;
  return href || null;
}

/** Retarget or hide a funnel "Mở Báo giá" CTA so Sales never lands on a 403 page. */
export function salesSafeQuoteAction(
  action: FunnelPrimaryAction | null | undefined,
  input: { isSales: boolean; quoteVisible: boolean },
): FunnelPrimaryAction | null {
  if (!action) return null;
  const isOpenQuote =
    OPEN_QUOTE_LABEL.test(action.label ?? '') ||
    (action.kind === 'link' && isProposalsNewHref(action.href)) ||
    (action.kind === 'anchor' && (action.anchor === '#funnel-presales' || action.anchor === LEAD_QUOTE_SHEET_HASH) && OPEN_QUOTE_LABEL.test(action.label ?? ''));
  if (!isOpenQuote) {
    // Still retarget a raw proposals/new link even if the label differs.
    if (action.kind === 'link' && isProposalsNewHref(action.href)) {
      if (input.isSales && !input.quoteVisible) return null;
      if (input.quoteVisible) {
        return { kind: 'anchor', label: action.label || 'Mở Báo giá', disabled: false, anchor: LEAD_QUOTE_SHEET_HASH };
      }
    }
    return action;
  }
  if (input.isSales && !input.quoteVisible) return null;
  if (input.quoteVisible || input.isSales) {
    return {
      kind: 'anchor',
      label: action.label || 'Mở Báo giá',
      disabled: false,
      anchor: LEAD_QUOTE_SHEET_HASH,
    };
  }
  return action;
}
