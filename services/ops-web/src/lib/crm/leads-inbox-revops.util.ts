import type { LeadRow } from '@/lib/api';
import type { LeadScoreSummary } from '@/lib/ai-api';

export type LeadIcpScoreTag = 'Hot' | 'Warm' | 'Fit' | null;

export function leadIcpScoreTag(
  lead: LeadRow,
  score?: LeadScoreSummary | null,
): LeadIcpScoreTag {
  const band = score?.score_band ?? lead.ai_band ?? null;
  if (band === 'hot') return 'Hot';
  if (band === 'warm') return 'Warm';
  if (band === 'cold') return 'Fit';
  if (score?.score_value != null) return 'Fit';
  return null;
}

export function leadIcpScoreTagClass(tag: LeadIcpScoreTag): string {
  switch (tag) {
    case 'Hot':
      return 'revops-tag revops-tag--red';
    case 'Warm':
      return 'revops-tag revops-tag--orange';
    case 'Fit':
      return 'revops-tag revops-tag--green';
    default:
      return 'revops-tag revops-tag--gray';
  }
}

/** Returns SLA label when row has real SLA signal; null means hide cell content. */
export function leadFirstResponseSlaLabel(lead: LeadRow): string | null {
  if (lead.review_queue?.active) {
    const hours = lead.review_queue.hours_waiting;
    if (hours != null && hours >= 0) {
      if (hours >= 24) return `T+${Math.floor(hours / 24)}d`;
      return `T+${Math.round(hours)}h`;
    }
    return 'Chờ tra soát';
  }
  if (lead.sla_state && lead.sla_state !== 'na') {
    if (lead.sla_state === 'breach') return 'Breached';
    if (lead.sla_state === 'warning') return 'Sắp hết hạn';
    if (lead.sla_state === 'ok') return 'OK';
  }
  return null;
}

export function shouldShowFirstResponseSlaColumn(rows: LeadRow[]): boolean {
  return rows.some((row) => leadFirstResponseSlaLabel(row) != null);
}

export const REVOPS_ROUTING_WATERFALL = [
  { step: 1, title: 'Existing Account Match', detail: 'Khớp account / client hiện có' },
  { step: 2, title: 'Named Account / Territory', detail: 'Theo territory & named account' },
  { step: 3, title: 'Capacity & Skill', detail: 'Năng lực AM/AE và kỹ năng sản phẩm' },
  { step: 4, title: 'Fallback Queue', detail: 'Weighted round-robin khi không match' },
] as const;

export const REVOPS_SLA_ESCALATION_TIMELINE = [
  { at: 'T+0', label: 'Assigned', detail: 'Lead được gán owner' },
  { at: 'T+3', label: 'Reminder', detail: 'Nhắc first response' },
  { at: 'T+5', label: 'Breach', detail: 'Vi phạm SLA phản hồi' },
  { at: 'T+10', label: 'Reassign', detail: 'Tự động chuyển queue (W3 simulate)' },
] as const;

export type LeadsSavedView = 'all' | 'lead_p1';

export function isLeadP1SavedView(view: string | null | undefined): boolean {
  return view === 'p1' || view === 'lead_p1';
}

export function leadP1Filters(): { status: string; unassigned_only: true } {
  return { status: 'moi', unassigned_only: true };
}
