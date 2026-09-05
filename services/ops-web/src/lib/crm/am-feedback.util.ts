export const AM_FEEDBACK_KINDS = ['csat', 'nps', 'complaint', 'response', 'comment'] as const;
export type AmFeedbackKind = (typeof AM_FEEDBACK_KINDS)[number];

export const AM_FEEDBACK_KIND_LABELS: Record<AmFeedbackKind, string> = {
  csat: 'CSAT',
  nps: 'NPS',
  complaint: 'Complaint',
  response: 'Response',
  comment: 'Comment',
};

export function amFeedbackDash(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amShouldCreateCsatTask(
  score: number | null | undefined,
  threshold = 3,
): boolean {
  return score != null && Number.isFinite(score) && score <= threshold;
}

export function amFeedbackCsdHref(ticketId: string | null | undefined): string | null {
  const id = String(ticketId ?? '').trim();
  if (!id) return null;
  return `/crm/csd/tickets/${id}`;
}

export function amFeedbackKindLabel(kind: string | null | undefined): string {
  const key = String(kind ?? '').trim().toLowerCase();
  if ((AM_FEEDBACK_KINDS as readonly string[]).includes(key)) {
    return AM_FEEDBACK_KIND_LABELS[key as AmFeedbackKind];
  }
  return '—';
}

export function amFeedbackDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const text = iso.slice(0, 10);
  return text || '—';
}
