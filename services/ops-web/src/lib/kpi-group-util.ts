export type KpiGroupStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type KpiGroupScopeType = 'ORGANIZATION' | 'DEPARTMENT' | 'POSITION' | 'CUSTOM';
export type KpiGroupDirection = 'INCREASE' | 'DECREASE' | 'RANGE';

export const KPI_GROUP_STATUSES: KpiGroupStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];

export const KPI_GROUP_STATUS_LABELS: Record<KpiGroupStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng sử dụng',
};

export const KPI_GROUP_SCOPE_LABELS: Record<KpiGroupScopeType, string> = {
  ORGANIZATION: 'Toàn doanh nghiệp',
  DEPARTMENT: 'Theo phòng ban',
  POSITION: 'Theo chức danh',
  CUSTOM: 'Tùy chỉnh',
};

export const KPI_GROUP_DIRECTION_LABELS: Record<KpiGroupDirection, string> = {
  INCREASE: 'Tăng dần',
  DECREASE: 'Giảm dần',
  RANGE: 'Duy trì trong ngưỡng',
};

export const KPI_GROUP_UNIT_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'COUNT', label: 'Số lượng' },
  { id: 'PERCENT', label: '%' },
  { id: 'CURRENCY', label: 'VNĐ' },
  { id: 'POINT', label: 'Điểm' },
  { id: 'HOUR', label: 'Giờ' },
  { id: 'DAY', label: 'Ngày' },
  { id: 'CUSTOMER', label: 'Khách hàng' },
  { id: 'LEAD', label: 'Lead' },
  { id: 'VISIT', label: 'Lượt' },
];

export const KPI_GROUP_DATA_DOMAIN_OPTIONS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'CRM', label: 'CRM', icon: '👥' },
  { id: 'MARKETING_AUTOMATION', label: 'Marketing Automation', icon: '⚡' },
  { id: 'ADS', label: 'Ads', icon: '📢' },
  { id: 'WEBSITE_SEO', label: 'Website/SEO', icon: '🌐' },
  { id: 'SOCIAL', label: 'Social', icon: '💬' },
  { id: 'SURVEY', label: 'Survey', icon: '📋' },
  { id: 'MANUAL', label: 'Manual', icon: '✏️' },
];

export const KPI_GROUP_ICON_OPTIONS = [
  'trending-up',
  'trending-down',
  'target',
  'bar-chart',
  'pie-chart',
  'users',
  'dollar-sign',
  'activity',
  'award',
  'zap',
];

export const KPI_GROUP_ERROR_MESSAGES: Record<string, string> = {
  KPI_GROUP_CODE_REQUIRED: 'Vui lòng nhập mã Nhóm KPI',
  KPI_GROUP_CODE_INVALID: 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới',
  KPI_GROUP_CODE_DUPLICATE: 'Mã Nhóm KPI đã tồn tại trong doanh nghiệp',
  KPI_GROUP_NAME_REQUIRED: 'Vui lòng nhập tên Nhóm KPI',
  KPI_GROUP_NAME_DUPLICATE: 'Tên Nhóm KPI đã tồn tại trong doanh nghiệp',
  KPI_GROUP_SCOPE_REQUIRED: 'Vui lòng chọn phạm vi hoặc phòng ban áp dụng',
  KPI_GROUP_DIRECTION_REQUIRED: 'Vui lòng chọn hướng đo mặc định',
  KPI_GROUP_ORDER_INVALID: 'Thứ tự hiển thị phải là số nguyên dương',
  KPI_GROUP_DELETE_REFERENCED: 'Không thể xóa Nhóm KPI đang được sử dụng',
  KPI_GROUP_COLOR_INVALID: 'Màu phải là mã HEX hợp lệ (#RRGGBB)',
};

export function labelKpiGroupStatus(status: string): string {
  return KPI_GROUP_STATUS_LABELS[status as KpiGroupStatus] ?? status;
}

export function labelKpiGroupScope(scope: string): string {
  return KPI_GROUP_SCOPE_LABELS[scope as KpiGroupScopeType] ?? scope;
}

export function labelKpiGroupDirection(direction: string): string {
  return KPI_GROUP_DIRECTION_LABELS[direction as KpiGroupDirection] ?? direction;
}

export function kpiGroupStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'kpi-group-badge kpi-group-badge--active';
    case 'INACTIVE':
      return 'kpi-group-badge kpi-group-badge--inactive';
    case 'DRAFT':
    default:
      return 'kpi-group-badge kpi-group-badge--draft';
  }
}

export function kpiGroupDirectionIcon(direction: string): string {
  switch (direction) {
    case 'INCREASE':
      return '↑';
    case 'DECREASE':
      return '↓';
    case 'RANGE':
      return '↔';
    default:
      return '•';
  }
}

export function labelKpiGroupUnitType(id: string): string {
  return KPI_GROUP_UNIT_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelKpiGroupDataDomain(id: string): string {
  return KPI_GROUP_DATA_DOMAIN_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function kpiGroupErrorMessage(code: string): string {
  return KPI_GROUP_ERROR_MESSAGES[code] ?? code;
}
