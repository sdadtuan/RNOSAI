/** Kanban status written when a lead is handed to Solution. */
export const SOLUTION_HANDOFF_LEAD_STATUS = 'dang_tu_van';

/** Early statuses that move to Đang tư vấn. Later and closed statuses stay put. */
export const STATUSES_PROMOTED_ON_SOLUTION_HANDOFF = [
  'moi',
  'new',
  'intake',
  'first_contact',
  'da_lien_he',
  'contacted',
  'qualified',
  'qualify',
] as const;

export function leadStatusAfterSolutionHandoff(current: string | null | undefined): string | null {
  const status = String(current ?? '').trim().toLowerCase();
  if ((STATUSES_PROMOTED_ON_SOLUTION_HANDOFF as readonly string[]).includes(status)) {
    return SOLUTION_HANDOFF_LEAD_STATUS;
  }
  return null;
}

export const PRESALES_HANDOFF_STATUSES = ['', 'pending', 'with_solution', 'released'] as const;
export type PresalesHandoffStatus = (typeof PRESALES_HANDOFF_STATUSES)[number];

export function normalizeHandoffStatus(raw: unknown): PresalesHandoffStatus {
  const s = String(raw ?? '').trim();
  if (s === 'pending' || s === 'with_solution' || s === 'released') return s;
  return '';
}

export function isHandoffActive(status: PresalesHandoffStatus): boolean {
  return status === 'pending' || status === 'with_solution';
}

/** Block direct advance consult→proposal until Solution releases (legacy empty = allowed). */
export function blocksDirectProposalAdvance(status: PresalesHandoffStatus): boolean {
  return status === 'pending' || status === 'with_solution';
}

export function handoffBadgeLabel(
  status: PresalesHandoffStatus,
  ownerName?: string | null,
): string | null {
  if (status === 'pending') return 'Đang chờ Solution/MKT nhận case';
  if (status === 'with_solution') {
    const who = String(ownerName ?? '').trim();
    return who ? `Đang Solution/MKT — ${who}` : 'Đang Solution/MKT xử lý';
  }
  return null;
}
