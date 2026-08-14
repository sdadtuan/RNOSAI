export const PORTAL_RESEARCH_ERROR_VI: Record<string, string> = {
  embargo_active: 'Báo cáo đang trong thời gian cấm công bố.',
  report_expired: 'Báo cáo đã hết hạn.',
  not_found: 'Không tìm thấy báo cáo.',
  forbidden: 'Bạn không có quyền xem báo cáo này.',
  market_research_disabled: 'Tính năng nghiên cứu thị trường chưa bật.',
};

export function portalResearchErrorVi(code: string): string {
  return PORTAL_RESEARCH_ERROR_VI[code] ?? 'Không tải được báo cáo.';
}
