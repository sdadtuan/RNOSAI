import { describe, expect, it } from 'vitest';
import {
  LEAD_QUOTE_SHEET_HASH,
  isProposalsNewHref,
  resolveLeadQuoteOpenHref,
  salesSafeQuoteAction,
} from './sales-quote-open.util';
import type { FunnelPrimaryAction } from './funnel-stepper.types';

describe('resolveLeadQuoteOpenHref', () => {
  it('sends Sales to the in-page read-only sheet when it is visible', () => {
    expect(
      resolveLeadQuoteOpenHref({
        isSales: true,
        quoteSheetVisible: true,
        existingProposalHref: '/crm/proposals/new?lead_id=900000120',
      }),
    ).toBe(LEAD_QUOTE_SHEET_HASH);
  });

  it('hides the control for Sales when there is no viewable sheet (never proposals/new)', () => {
    expect(
      resolveLeadQuoteOpenHref({
        isSales: true,
        quoteSheetVisible: false,
        existingProposalHref: '/crm/proposals/new?lead_id=1',
      }),
    ).toBeNull();
  });

  it('does not send non-Sales to proposals/new when the in-page sheet is available', () => {
    expect(
      resolveLeadQuoteOpenHref({
        isSales: false,
        quoteSheetVisible: true,
        existingProposalHref: '/crm/proposals/new?lead_id=1',
      }),
    ).toBe(LEAD_QUOTE_SHEET_HASH);
  });

  it('keeps an existing proposal document link for non-Sales', () => {
    expect(
      resolveLeadQuoteOpenHref({
        isSales: false,
        quoteSheetVisible: false,
        existingProposalHref: '/crm/proposals/42',
      }),
    ).toBe('/crm/proposals/42');
  });
});

describe('isProposalsNewHref', () => {
  it('detects the create-proposal path that 403s for Sales', () => {
    expect(isProposalsNewHref('/crm/proposals/new?lead_id=1')).toBe(true);
    expect(isProposalsNewHref('/crm/proposals/12')).toBe(false);
    expect(isProposalsNewHref(LEAD_QUOTE_SHEET_HASH)).toBe(false);
  });
});

describe('salesSafeQuoteAction', () => {
  const openAnchor: FunnelPrimaryAction = {
    kind: 'anchor',
    label: 'Mở Báo giá',
    disabled: false,
    anchor: '#funnel-presales',
  };

  it('retargets Sales "Mở Báo giá" to the in-page sheet', () => {
    const out = salesSafeQuoteAction(openAnchor, { isSales: true, quoteVisible: true });
    expect(out?.kind).toBe('anchor');
    expect(out && 'anchor' in out ? out.anchor : '').toBe(LEAD_QUOTE_SHEET_HASH);
  });

  it('hides Sales "Mở Báo giá" when the sheet is not on the page', () => {
    expect(salesSafeQuoteAction(openAnchor, { isSales: true, quoteVisible: false })).toBeNull();
  });

  it('rewrites a proposals/new link so it never 403s', () => {
    const link: FunnelPrimaryAction = {
      kind: 'link',
      label: 'Mở báo giá',
      disabled: false,
      href: '/crm/proposals/new?lead_id=9',
    };
    const out = salesSafeQuoteAction(link, { isSales: true, quoteVisible: true });
    expect(out?.kind).toBe('anchor');
    expect(out && 'anchor' in out ? out.anchor : '').toBe(LEAD_QUOTE_SHEET_HASH);
    expect(salesSafeQuoteAction(link, { isSales: true, quoteVisible: false })).toBeNull();
  });

  it('leaves unrelated actions alone', () => {
    const other: FunnelPrimaryAction = {
      kind: 'advance_presales',
      label: 'Chuyển → Báo giá',
      disabled: false,
    };
    expect(salesSafeQuoteAction(other, { isSales: true, quoteVisible: true })).toEqual(other);
  });
});
