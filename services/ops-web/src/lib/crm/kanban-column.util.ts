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

const NEW_STATUSES = new Set(['moi', 'new', 'first_contact']);

export interface KanbanPulse {
  slaLate: number;
  callbackToday: number;
  quoteStale: number;
  withinSlaPct: number;
  leftNewPct: number;
  stale: number;
}

export function showKanbanLeaderPulse(jobFunctions: string[] | null | undefined): boolean {
  return (jobFunctions ?? []).includes('leader');
}

/** Counts on the board already loaded. Thresholds are stamped on each row by the API. */
export function kanbanPulse(
  leads: Array<
    Pick<LeadRow, 'status' | 'sla_state' | 'stale' | 'quote_stale' | 'callback_today'>
  >,
): KanbanPulse {
  const total = leads.length;
  const slaLate = leads.filter((lead) => lead.sla_state === 'breach').length;
  const leftNew = leads.filter((lead) => !NEW_STATUSES.has(String(lead.status ?? '').trim().toLowerCase())).length;
  const pct = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  return {
    slaLate,
    callbackToday: leads.filter((lead) => lead.callback_today).length,
    quoteStale: leads.filter((lead) => lead.quote_stale).length,
    withinSlaPct: pct(total - slaLate),
    leftNewPct: pct(leftNew),
    stale: leads.filter((lead) => lead.stale).length,
  };
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
