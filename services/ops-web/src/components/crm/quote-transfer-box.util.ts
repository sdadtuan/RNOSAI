/** Hide the optional "Chuyển AM" box when the lead already has an AM. SUPER-ADMIN keeps it. */
export function shouldShowQuoteTransferBox(opts: {
  viewerIsCeo: boolean;
  viewerIsSuperAdmin?: boolean;
  expectedRole?: string | null;
  candidateCount: number;
  assigneeStaffId?: number | null;
}): boolean {
  if (!opts.viewerIsCeo) return false;
  if (!opts.expectedRole) return false;
  if (opts.candidateCount <= 0) return false;
  if (opts.viewerIsSuperAdmin) return true;
  const role = String(opts.expectedRole).trim().toLowerCase();
  const isAmRole = role === 'am' || role.includes('marketing');
  const assignee = Number(opts.assigneeStaffId);
  if (isAmRole && Number.isFinite(assignee) && assignee > 0) return false;
  return true;
}
