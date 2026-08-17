export const STAFF_REPORT_VERSION_STALE_BADGE =
  'Có nội dung có thể đã lỗi thời';

export function shouldShowStaffVersionStaleBadge(hasStaleInsights: boolean): boolean {
  return hasStaleInsights;
}
