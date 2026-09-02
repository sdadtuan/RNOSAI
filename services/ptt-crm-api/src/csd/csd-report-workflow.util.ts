import type { CsdReportStatus } from './csd.types';

export const CSD_REPORT_TRANSITIONS: Record<CsdReportStatus, CsdReportStatus[]> = {
  draft: ['data_pending', 'in_review', 'approved', 'sent', 'cancelled'],
  data_pending: ['draft', 'in_review', 'cancelled'],
  in_review: ['approved', 'changes_requested', 'cancelled'],
  changes_requested: ['draft', 'in_review', 'cancelled'],
  approved: ['scheduled', 'sent', 'in_review', 'archived'],
  scheduled: ['sent', 'approved', 'cancelled'],
  sent: ['archived'],
  viewed: ['acknowledged', 'archived'],
  acknowledged: ['archived'],
  archived: [],
  cancelled: [],
};

export function canTransitionReport(
  from: CsdReportStatus,
  to: CsdReportStatus,
  opts: { requires_approval: boolean; bypass: boolean },
): boolean {
  if (from === 'sent' && to === 'draft') return false;

  const allowed = CSD_REPORT_TRANSITIONS[from]?.includes(to) ?? false;
  if (!allowed) return false;

  if (from === 'draft' && (to === 'sent' || to === 'approved')) {
    return !opts.requires_approval || opts.bypass;
  }

  return true;
}
