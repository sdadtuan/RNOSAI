export type QuoteStatus =
  | 'draft'
  | 'in_review'
  | 'pending_approval'
  | 'returned'
  | 'approved'
  | 'sent'
  | 'viewed'
  | 'negotiation'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'superseded'
  | 'archived';

export type QuoteScope = 'me' | 'team' | 'all';

export type QuoteVersionState =
  | 'working'
  | 'submitted'
  | 'approved'
  | 'published'
  | 'accepted'
  | 'superseded';

export type QuoteOptionKey = 'A' | 'B' | 'C';

export type QuoteItemType = 'fee' | 'media';

export const QT_KPI_KEYS = [
  'open_quote_value',
  'pending_approval_count',
  'quote_win_rate',
  'forecast_gross_margin',
] as const;

export type QtKpiKey = (typeof QT_KPI_KEYS)[number];

export function emptyKpis(): Record<QtKpiKey, number | null> {
  return {
    open_quote_value: null,
    pending_approval_count: null,
    quote_win_rate: null,
    forecast_gross_margin: null,
  };
}
