import { ancestorIds, isOnPath } from './iwr-org.util';
import type { IwrActor, IwrReportRow, IwrStaffNode } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

export async function canViewIwrReport(
  actor: IwrActor,
  report: IwrReportRow,
  deps: {
    isRecipient: (reportId: string, staffId: number) => Promise<boolean>;
    listActiveStaff: () => Promise<IwrStaffNode[]>;
  },
): Promise<boolean> {
  if (report.author_staff_id === actor.staffId) return true;
  if (hasIwrCap(actor, 'manage') || hasIwrCap(actor, 'executive')) return true;
  if (await deps.isRecipient(report.id, actor.staffId)) return true;
  const nodes = await deps.listActiveStaff();
  const ancestors = ancestorIds(report.author_staff_id, nodes);
  if (ancestors.includes(actor.staffId)) return true;
  return isOnPath(actor.staffId, report.author_staff_id, nodes);
}
