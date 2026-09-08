import type { QuoteStatus } from './quote.types';

export type { QuoteStatus };

const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['in_review', 'pending_approval', 'cancelled'],
  in_review: ['draft', 'pending_approval', 'returned', 'cancelled'],
  pending_approval: ['approved', 'returned', 'rejected', 'cancelled'],
  returned: ['draft', 'in_review', 'pending_approval', 'cancelled'],
  approved: ['sent', 'superseded', 'cancelled'],
  sent: ['viewed', 'negotiation', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded'],
  viewed: ['negotiation', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded'],
  negotiation: ['sent', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded'],
  accepted: ['superseded', 'archived'],
  rejected: ['draft', 'archived'],
  expired: ['draft', 'archived'],
  cancelled: ['archived'],
  superseded: ['archived'],
  archived: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function mapLegacyStatus(s: 'draft' | 'sent' | 'accepted' | 'rejected'): QuoteStatus {
  return s;
}
