/** Hide the optional transfer box when it has no purpose on this phase. SUPER-ADMIN keeps it on quote phases. */
const QUOTE_TRANSFER_PHASES = new Set([
  'chuyen_bao_gia',
  'bao_gia',
  'ceo_review',
  'sale_review',
]);

export function shouldShowQuoteTransferBox(opts: {
  viewerIsCeo: boolean;
  viewerIsSuperAdmin?: boolean;
  expectedRole?: string | null;
  candidateCount: number;
  assigneeStaffId?: number | null;
  /** When provided, hide outside quote-assignment phases (e.g. sale_approve_solution). */
  phase?: string | null;
}): boolean {
  if (!opts.viewerIsCeo) return false;
  if (!opts.expectedRole) return false;
  if (opts.candidateCount <= 0) return false;
  const phase = String(opts.phase ?? '').trim().toLowerCase();
  if (phase && !QUOTE_TRANSFER_PHASES.has(phase)) return false;
  if (opts.viewerIsSuperAdmin) return true;
  const role = String(opts.expectedRole).trim().toLowerCase();
  const isAmRole = role === 'am' || role.includes('marketing');
  const assignee = Number(opts.assigneeStaffId);
  if (isAmRole && Number.isFinite(assignee) && assignee > 0) return false;
  return true;
}
