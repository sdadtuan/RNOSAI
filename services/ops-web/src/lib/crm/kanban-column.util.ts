import type { LeadRow } from '@/lib/api';

export const KANBAN_COLUMN_PAGE = 20;

/** B2B Kanban columns sorted by last interaction only (no hot/warm/SLA rank). */
export const KANBAN_RECENCY_FIRST_COLUMN_IDS = new Set(['da_lien_he']);

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

function stampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function receivedMs(lead: Pick<LeadRow, 'received_at' | 'created_at'>): number {
  return Math.max(stampMs(lead.received_at), stampMs(lead.created_at));
}

/** Most recent care, call, or status change — cột Đã liên hệ only. */
export function interactionMs(
  lead: Pick<LeadRow, 'updated_at' | 'last_call_at' | 'received_at' | 'created_at'>,
): number {
  return Math.max(
    stampMs(lead.updated_at),
    stampMs(lead.last_call_at),
    stampMs(lead.received_at),
    stampMs(lead.created_at),
  );
}

const NEW_STATUSES = new Set(['moi', 'new', 'intake']);

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

/** Most recently interacted first (used for Đã liên hệ). */
export function sortKanbanLeadsByRecency<
  T extends Pick<LeadRow, 'updated_at' | 'last_call_at' | 'received_at' | 'created_at'>,
>(leads: T[]): T[] {
  return [...leads].sort((a, b) => interactionMs(b) - interactionMs(a));
}

/** Late, then almost late, then hot, warm, cold, then newest received (other columns). */
export function sortKanbanLeads<
  T extends Pick<LeadRow, 'ai_band' | 'sla_state' | 'received_at' | 'created_at'>,
>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const rank = priority(a) - priority(b);
    if (rank !== 0) return rank;
    return receivedMs(b) - receivedMs(a);
  });
}

export function sortKanbanLeadsForColumn<
  T extends Pick<
    LeadRow,
    'ai_band' | 'sla_state' | 'updated_at' | 'last_call_at' | 'received_at' | 'created_at'
  >,
>(columnId: string, leads: T[]): T[] {
  if (KANBAN_RECENCY_FIRST_COLUMN_IDS.has(columnId)) {
    return sortKanbanLeadsByRecency(leads);
  }
  return sortKanbanLeads(leads);
}
