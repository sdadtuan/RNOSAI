export const SKPI_SUBTITLES = {
  warroom:
    'SKPI-00 · Nhịp vận hành tuần — không phải dashboard thứ hai. Việc hôm nay: assumption, alert, data stale, lệch KPI+GM, quote score cao.',
  overview:
    'SKPI-00 · Dashboard vận hành template, instance, readiness và rủi ro theo Portfolio 21 DV.',
  templates:
    'SKPI-01 · Cấu hình bộ KPI chuẩn cho Service Catalog (Portfolio 21 DV), package và vertical.',
  instances:
    'SKPI-03 · KPI kế thừa/cấu hình theo Quote, Proposal, Project, Work Order hoặc Campaign.',
  measurement:
    'SKPI-05 · Kế hoạch đo: source mapping, formula snapshot, owner, cadence, QA và freshness SLA.',
  tracking:
    'SKPI-06 · Ghi nhận actual từ API, CSV/XLSX, manual entry; kiểm soát quality và reconciliation.',
  contracts:
    'SKPI-09 · Điểm rủi ro hợp đồng KPI — duyệt cùng GM floor. Internal only. Không xuống proposal.',
  reconcile:
    'SKPI-10 · Ba sổ. Cấm xuất Reported từ actual Unverified. Chênh material → Change Order.',
  packs:
    'SKPI-11 · Rule + từ cấm + reviewer theo ngành. Functional Lead không override pack regulated.',
} as const;

export type SkpiSubtitleKey = keyof typeof SKPI_SUBTITLES;

export const WAR_ROOM_TILE_LABELS = {
  critical: 'CRITICAL QUÁ HẠN',
  assumptions: 'ASSUMPTION MỞ',
  blockedReports: 'CẤM XUẤT REPORT',
  quoteScore: 'QUOTE SCORE ≥ 70',
} as const;

export const OVERVIEW_TILE_LABELS = {
  templateActive: 'SERVICE TEMPLATE ACTIVE',
  instanceTracking: 'INSTANCE TRACKING',
  readinessWarning: 'READINESS WARNING',
  kpiAtRisk: 'KPI AT RISK',
} as const;

export const CLASSIFICATION_LABELS: Record<
  string,
  { label: string; tone: 'blue' | 'purple' | 'amber' | 'green' | 'gray' }
> = {
  COMMITTED_DELIVERABLE: { label: 'Cam kết bàn giao', tone: 'blue' },
  OPTIMIZATION_TARGET: { label: 'Mục tiêu tối ưu', tone: 'purple' },
  PROJECTED_RESULT: { label: 'Kết quả dự kiến', tone: 'amber' },
  BUSINESS_OUTCOME: { label: 'Business Outcome', tone: 'amber' },
  QUALITY_STANDARD: { label: 'Quality', tone: 'green' },
  INTERNAL_OPERATIONAL: { label: 'Internal', tone: 'gray' },
};

export const CLASSIFICATION_GROUP_LABELS: Record<string, string> = {
  COMMITTED_DELIVERABLE: 'Cam kết bàn giao',
  QUALITY_STANDARD: 'Quality standard',
  OPTIMIZATION_TARGET: 'Performance & Forecast',
  PROJECTED_RESULT: 'Performance & Forecast',
  BUSINESS_OUTCOME: 'Business outcome',
  INTERNAL_OPERATIONAL: 'Internal operational',
};

export const MOAT_WAR_ROOM =
  'AgencyAnalytics thấy health KPI. Productive thấy GM. Chỉ RNOSAI thấy cả hai trên cùng hàng đợi — và chặn bán tiếp.';

export const MOAT_CONTRACT =
  'AgencyAnalytics không biết GM. Productive biết utilization, không biết CPL có phải cam kết. HubSpot duyệt deal, không duyệt ngôn ngữ forecast trên proposal agency. RNOSAI cộng Score vào cổng Quote OS đã có.';

export const MOAT_RECONCILE_SUCCESS =
  'Quoted = snapshot pháp lý. Delivered = vận hành. Reported = đã QA + client-visible. Dashboard SaaS chỉ có sổ Reported.';

export const SNAPSHOT_INSTANCE_BANNER =
  'KPI Instance giữ Target, Scenario, Baseline, Assumption, Disclaimer theo ngữ cảnh client. Quote publish tạo KPI Snapshot client-visible; Quote Accepted kế thừa vào Project để tracking actual.';

export const PORTFOLIO_TEMPLATE_NOTICE =
  'Template chỉ chọn KPI Definition Active từ KPI Dictionary. Khi Account thêm DV vào Quote, hệ thống clone Template Version thành KPI Instances. Template mới không ghi đè snapshot proposal/project đã phát hành.';

export const WORDING_FIREWALL_COPY =
  'Rule-based Wave 1 (không LLM). Quét proposal: nếu classification = PROJECTED_RESULT mà copy chứa “cam kết / đảm bảo / chắc chắn X lead” → block.';

export const SIDE_NOTE_KPI_CONTRACT =
  '2 quote score ≥70 chờ duyệt cùng GM · 1 report bị chặn actual Unverified · 4 assumption khách chưa confirm.';

export const CONTRACT_FORMULA = 'Risk = 0.25 Class + 0.25 Aggr + 0.20 Assume + 0.15 Data + 0.15 Margin';

export const ZERO_DENOMINATOR_VAR = {
  name: 'zero denominator',
  detail: 'Return N/A; tạo Data Quality Alert.',
};
