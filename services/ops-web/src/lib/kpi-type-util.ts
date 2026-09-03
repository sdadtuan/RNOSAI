export type KpiTypeStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type KpiTypeScopeType = 'ORGANIZATION' | 'DEPARTMENT' | 'POSITION' | 'CUSTOM';
export type KpiTypeDirection = 'INCREASE' | 'DECREASE' | 'RANGE';
export type KpiTypeValueType =
  | 'INTEGER'
  | 'DECIMAL'
  | 'PERCENTAGE'
  | 'CURRENCY'
  | 'DURATION'
  | 'SCORE'
  | 'BOOLEAN';
export type KpiTypeTargetMode = 'SINGLE_TARGET' | 'THRESHOLD' | 'RANGE';
export type KpiTypeCalculationMode = 'AUTO' | 'MANUAL' | 'HYBRID';
export type KpiTypeValidationStatus = 'NOT_TESTED' | 'VALID' | 'INVALID' | 'CONNECTION_ERROR';

export const KPI_TYPE_STATUSES: KpiTypeStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];

export const KPI_TYPE_STATUS_LABELS: Record<KpiTypeStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng sử dụng',
};

export const KPI_TYPE_DIRECTION_LABELS: Record<KpiTypeDirection, string> = {
  INCREASE: 'Tăng dần',
  DECREASE: 'Giảm dần',
  RANGE: 'Duy trì trong ngưỡng',
};

export const KPI_TYPE_VALUE_TYPE_LABELS: Record<KpiTypeValueType, string> = {
  INTEGER: 'Số nguyên',
  DECIMAL: 'Số thập phân',
  PERCENTAGE: 'Phần trăm',
  CURRENCY: 'Tiền tệ',
  DURATION: 'Thời lượng',
  SCORE: 'Điểm',
  BOOLEAN: 'Có / Không',
};

export const KPI_TYPE_TARGET_MODE_LABELS: Record<KpiTypeTargetMode, string> = {
  SINGLE_TARGET: 'Mục tiêu đơn',
  THRESHOLD: 'Ngưỡng',
  RANGE: 'Khoảng',
};

export const KPI_TYPE_CALC_LABELS: Record<KpiTypeCalculationMode, string> = {
  AUTO: 'Đồng bộ tự động',
  MANUAL: 'Nhập thủ công',
  HYBRID: 'Kết hợp',
};

export const KPI_TYPE_VALIDATION_LABELS: Record<KpiTypeValidationStatus, string> = {
  NOT_TESTED: 'Chưa kiểm tra',
  VALID: 'Công thức hợp lệ',
  INVALID: 'Có lỗi',
  CONNECTION_ERROR: 'Lỗi kết nối',
};

export const KPI_TYPE_SCOPE_LABELS: Record<KpiTypeScopeType, string> = {
  ORGANIZATION: 'Toàn doanh nghiệp',
  DEPARTMENT: 'Theo phòng ban',
  POSITION: 'Theo chức danh',
  CUSTOM: 'Tùy chỉnh',
};

export const KPI_TYPE_ERROR_MESSAGES: Record<string, string> = {
  KPI_TYPE_GROUP_REQUIRED: 'Vui lòng chọn Nhóm KPI',
  KPI_TYPE_GROUP_INACTIVE: 'Không thể sử dụng Nhóm KPI đã ngừng hoạt động',
  KPI_TYPE_CODE_REQUIRED: 'Vui lòng nhập mã KPI Type',
  KPI_TYPE_CODE_INVALID: 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới',
  KPI_TYPE_CODE_DUPLICATE: 'Mã KPI Type đã tồn tại trong doanh nghiệp',
  KPI_TYPE_NAME_REQUIRED: 'Vui lòng nhập tên KPI Type',
  KPI_TYPE_NAME_DUPLICATE: 'Tên KPI Type đã tồn tại trong doanh nghiệp',
  KPI_TYPE_UNIT_REQUIRED: 'Vui lòng chọn đơn vị đo',
  KPI_TYPE_TARGET_INVALID: 'Kiểm tra lại thứ tự các ngưỡng mục tiêu theo hướng đo',
  KPI_TYPE_RANGE_INVALID: 'Giới hạn dưới phải nhỏ hơn hoặc bằng giới hạn trên',
  KPI_TYPE_AUTO_SOURCE_REQUIRED: 'Vui lòng chọn nguồn dữ liệu chính',
  KPI_TYPE_FORMULA_REQUIRED: 'Vui lòng nhập công thức hoặc cấu hình phép tổng hợp',
  KPI_TYPE_FORMULA_INVALID: 'Công thức không hợp lệ. Vui lòng kiểm tra cú pháp hoặc trường dữ liệu',
  KPI_TYPE_SCOPE_REQUIRED: 'Vui lòng chọn phạm vi áp dụng',
  KPI_TYPE_WEIGHT_INVALID: 'Trọng số tối thiểu phải nhỏ hơn hoặc bằng trọng số tối đa',
  KPI_TYPE_DELETE_REFERENCED: 'Không thể xóa KPI Type đang được sử dụng. Hãy ngừng sử dụng thay vì xóa',
  KPI_TYPE_VERSION_CONFLICT: 'Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại và thử lại',
  KPI_TYPE_SOURCE_UNAVAILABLE: 'Nguồn dữ liệu không khả dụng hoặc lỗi kết nối',
  KPI_TYPE_ACTIVATE_INVALID: 'Cần kiểm tra công thức hợp lệ trước khi kích hoạt AUTO/HYBRID',
  KPI_TYPE_NOT_FOUND: 'Không tìm thấy KPI Type',
  KPI_TYPE_STATUS_INVALID: 'Trạng thái không hợp lệ',
};

export function kpiTypeErrorMessage(code: string): string {
  return KPI_TYPE_ERROR_MESSAGES[code] ?? code;
}

export function labelKpiTypeStatus(status: string): string {
  return KPI_TYPE_STATUS_LABELS[status as KpiTypeStatus] ?? status;
}

export function labelKpiTypeDirection(direction: string): string {
  return KPI_TYPE_DIRECTION_LABELS[direction as KpiTypeDirection] ?? direction;
}

export function labelKpiTypeCalc(mode: string): string {
  return KPI_TYPE_CALC_LABELS[mode as KpiTypeCalculationMode] ?? mode;
}

export function labelKpiTypeScope(scope: string): string {
  return KPI_TYPE_SCOPE_LABELS[scope as KpiTypeScopeType] ?? scope;
}
