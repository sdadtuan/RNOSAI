import type { LeadRow } from '@/lib/api';

export const KANBAN_COLUMN_PAGE = 20;

/** Nóng and already late or almost late. */
export function isB2bLeadP1(lead: Pick<LeadRow, 'ai_band' | 'sla_state'>): boolean {
  return lead.ai_band === 'hot' && (lead.sla_state === 'breach' || lead.sla_state === 'warning');
}

function priority(lead: Pick<LeadRow, 'ai_band' | 'sla_state'>): number {
  if (lead.sla_state === 'breach') return 0;
  if (lead.sla_state === 'warning') return 1;
  if (lead.ai_band === 'hot') return 2;
  if (lead.ai_band === 'warm') return 3;
  return 4;
}

function receivedMs(lead: Pick<LeadRow, 'received_at' | 'created_at'>): number {
  const parsed = Date.parse(lead.received_at || lead.created_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Late, then almost late, then hot, warm, cold, then newest. */
export function sortKanbanLeads<T extends Pick<LeadRow, 'ai_band' | 'sla_state' | 'received_at' | 'created_at'>>(
  leads: T[],
): T[] {
  return [...leads].sort((a, b) => {
    const rank = priority(a) - priority(b);
    if (rank !== 0) return rank;
    return receivedMs(b) - receivedMs(a);
  });
}
