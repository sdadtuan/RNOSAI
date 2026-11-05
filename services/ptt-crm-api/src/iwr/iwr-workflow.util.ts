import type { IwrReportStatus } from './iwr.types';

export const IWR_TRANSITIONS: Record<IwrReportStatus, IwrReportStatus[]> = {
  draft: ['submitted', 'waived', 'archived'],
  submitted: ['changes_requested', 'acknowledged', 'archived'],
  changes_requested: ['supplemented', 'waived', 'archived'],
  supplemented: ['changes_requested', 'acknowledged', 'archived'],
  acknowledged: ['archived'],
  waived: ['archived'],
  archived: [],
};

export function canTransitionIwr(from: IwrReportStatus, to: IwrReportStatus): boolean {
  return IWR_TRANSITIONS[from]?.includes(to) ?? false;
}
