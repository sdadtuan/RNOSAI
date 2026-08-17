export const PORTAL_REPORT_LIST_STALE_BADGE =
  'Có nội dung có thể đã lỗi thời';

export function shouldShowReportListStaleBadge(
  card: { has_stale_insights?: boolean },
): boolean {
  return card.has_stale_insights === true;
}
