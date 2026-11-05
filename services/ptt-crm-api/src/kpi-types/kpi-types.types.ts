export const KPI_TYPES_TENANT_ID = 'PTT';

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
export type KpiTypeAggregation =
  | 'COUNT'
  | 'SUM'
  | 'AVG'
  | 'RATE'
  | 'DISTINCT_COUNT'
  | 'CUSTOM';
export type KpiTypeSyncFrequency = 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type KpiTypeDivideByZero = 'ZERO' | 'NA' | 'ERROR';
export type KpiTypeValidationStatus = 'NOT_TESTED' | 'VALID' | 'INVALID' | 'CONNECTION_ERROR';
export type KpiTypeSourceHealth =
  | 'UNKNOWN'
  | 'HEALTHY'
  | 'STALE'
  | 'CONNECTION_ERROR'
  | 'UNAVAILABLE';

export const KPI_TYPE_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const KPI_TYPE_SCOPE_TYPES = ['ORGANIZATION', 'DEPARTMENT', 'POSITION', 'CUSTOM'] as const;
export const KPI_TYPE_DIRECTIONS = ['INCREASE', 'DECREASE', 'RANGE'] as const;
export const KPI_TYPE_VALUE_TYPES = [
  'INTEGER',
  'DECIMAL',
  'PERCENTAGE',
  'CURRENCY',
  'DURATION',
  'SCORE',
  'BOOLEAN',
] as const;
export const KPI_TYPE_TARGET_MODES = ['SINGLE_TARGET', 'THRESHOLD', 'RANGE'] as const;
export const KPI_TYPE_CALCULATION_MODES = ['AUTO', 'MANUAL', 'HYBRID'] as const;
export const KPI_TYPE_AGGREGATIONS = [
  'COUNT',
  'SUM',
  'AVG',
  'RATE',
  'DISTINCT_COUNT',
  'CUSTOM',
] as const;
export const KPI_TYPE_SYNC_FREQUENCIES = [
  'REALTIME',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
] as const;
export const KPI_TYPE_DIVIDE_BY_ZERO = ['ZERO', 'NA', 'ERROR'] as const;

export const KPI_TYPE_ERROR_CODES = {
  GROUP_REQUIRED: 'KPI_TYPE_GROUP_REQUIRED',
  GROUP_INACTIVE: 'KPI_TYPE_GROUP_INACTIVE',
  CODE_REQUIRED: 'KPI_TYPE_CODE_REQUIRED',
  CODE_INVALID: 'KPI_TYPE_CODE_INVALID',
  CODE_DUPLICATE: 'KPI_TYPE_CODE_DUPLICATE',
  NAME_REQUIRED: 'KPI_TYPE_NAME_REQUIRED',
  NAME_DUPLICATE: 'KPI_TYPE_NAME_DUPLICATE',
  UNIT_REQUIRED: 'KPI_TYPE_UNIT_REQUIRED',
  TARGET_INVALID: 'KPI_TYPE_TARGET_INVALID',
  RANGE_INVALID: 'KPI_TYPE_RANGE_INVALID',
  AUTO_SOURCE_REQUIRED: 'KPI_TYPE_AUTO_SOURCE_REQUIRED',
  FORMULA_REQUIRED: 'KPI_TYPE_FORMULA_REQUIRED',
  FORMULA_INVALID: 'KPI_TYPE_FORMULA_INVALID',
  SCOPE_REQUIRED: 'KPI_TYPE_SCOPE_REQUIRED',
  WEIGHT_INVALID: 'KPI_TYPE_WEIGHT_INVALID',
  DELETE_REFERENCED: 'KPI_TYPE_DELETE_REFERENCED',
  VERSION_CONFLICT: 'KPI_TYPE_VERSION_CONFLICT',
  NOT_FOUND: 'KPI_TYPE_NOT_FOUND',
  STATUS_INVALID: 'KPI_TYPE_STATUS_INVALID',
  SOURCE_UNAVAILABLE: 'KPI_TYPE_SOURCE_UNAVAILABLE',
  ACTIVATE_INVALID: 'KPI_TYPE_ACTIVATE_INVALID',
} as const;

export type KpiTypeErrorCode = (typeof KPI_TYPE_ERROR_CODES)[keyof typeof KPI_TYPE_ERROR_CODES];

export type KpiTypeRef = { id: string; name: string; code?: string; color?: string };
export type KpiTypeUnitRef = { id: string; code: string; name: string; value_types?: string[] };
export type KpiTypeSourceRef = {
  id: string;
  code: string;
  name: string;
  adapter_key: string;
  health: KpiTypeSourceHealth;
  entities?: string[];
};
export type KpiTypeDeptRef = { id: number; name: string };
export type KpiTypePosRef = { id: number; name: string };
export type KpiTypeStaffRef = { id: number; name: string };

export type KpiTypeRow = {
  id: string;
  tenant_id: string;
  kpi_group_id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  direction: KpiTypeDirection;
  value_type: KpiTypeValueType;
  unit_id: string;
  decimal_places: number;
  target_mode: KpiTypeTargetMode;
  minimum_target: number | null;
  default_target: number;
  stretch_target: number | null;
  lower_limit: number | null;
  upper_limit: number | null;
  calculation_mode: KpiTypeCalculationMode;
  primary_data_source_id: string | null;
  data_entity: string | null;
  aggregation_type: KpiTypeAggregation | null;
  formula_expression: string | null;
  formula_display: string | null;
  sync_frequency: KpiTypeSyncFrequency | null;
  timezone: string;
  divide_by_zero_fallback: KpiTypeDivideByZero;
  manual_evidence_required: boolean;
  scope_type: KpiTypeScopeType;
  weight_min: number | null;
  weight_max: number | null;
  display_order: number;
  status: KpiTypeStatus;
  is_system_default: boolean;
  current_version: number;
  created_by_staff_id: number;
  updated_by_staff_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_staff_id: number | null;
  row_version: number;
  department_ids: number[];
  position_ids: number[];
  departments: KpiTypeDeptRef[];
  positions: KpiTypePosRef[];
  usage_count: number;
  updated_by_name: string | null;
  kpi_group: KpiTypeRef | null;
  unit: KpiTypeUnitRef | null;
  data_source: KpiTypeSourceRef | null;
  validation_status: KpiTypeValidationStatus;
};

export type KpiTypeListItem = {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  kpi_group: KpiTypeRef | null;
  direction: KpiTypeDirection;
  value_type: KpiTypeValueType;
  unit: KpiTypeUnitRef | null;
  calculation_mode: KpiTypeCalculationMode;
  data_source: KpiTypeSourceRef | null;
  usage_count: number;
  status: KpiTypeStatus;
  current_version: number;
  display_order: number;
  updated_at: string;
  updated_by: KpiTypeStaffRef | null;
  row_version: number;
};

export type KpiTypeDetail = KpiTypeListItem & {
  tenant_id: string;
  kpi_group_id: string;
  unit_id: string;
  decimal_places: number;
  target_mode: KpiTypeTargetMode;
  minimum_target: number | null;
  default_target: number;
  stretch_target: number | null;
  lower_limit: number | null;
  upper_limit: number | null;
  primary_data_source_id: string | null;
  data_entity: string | null;
  aggregation_type: KpiTypeAggregation | null;
  formula_expression: string | null;
  formula_display: string | null;
  sync_frequency: KpiTypeSyncFrequency | null;
  timezone: string;
  divide_by_zero_fallback: KpiTypeDivideByZero;
  manual_evidence_required: boolean;
  scope_type: KpiTypeScopeType;
  department_ids: number[];
  position_ids: number[];
  departments: KpiTypeDeptRef[];
  positions: KpiTypePosRef[];
  weight_min: number | null;
  weight_max: number | null;
  is_system_default: boolean;
  validation_status: KpiTypeValidationStatus;
  created_by_staff_id: number;
  created_at: string;
};

export type KpiTypeListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  kpi_group_id?: string;
  status?: string;
  calculation_mode?: string;
  direction?: string;
  department_id?: string;
  data_source_id?: string;
  sort?: string;
};

export type CreateKpiTypeBody = {
  kpi_group_id: string;
  code: string;
  name: string;
  short_name?: string | null;
  description?: string | null;
  direction: KpiTypeDirection;
  value_type: KpiTypeValueType;
  unit_id: string;
  decimal_places?: number;
  target_mode: KpiTypeTargetMode;
  minimum_target?: number | null;
  default_target: number;
  stretch_target?: number | null;
  lower_limit?: number | null;
  upper_limit?: number | null;
  calculation_mode: KpiTypeCalculationMode;
  primary_data_source_id?: string | null;
  data_entity?: string | null;
  aggregation_type?: KpiTypeAggregation | null;
  formula_expression?: string | null;
  formula_display?: string | null;
  sync_frequency?: KpiTypeSyncFrequency | null;
  timezone?: string;
  divide_by_zero_fallback?: KpiTypeDivideByZero;
  manual_evidence_required?: boolean;
  scope_type: KpiTypeScopeType;
  department_ids?: number[];
  position_ids?: number[];
  weight_min?: number | null;
  weight_max?: number | null;
  display_order?: number;
  status?: KpiTypeStatus;
};

export type PatchKpiTypeBody = Partial<Omit<CreateKpiTypeBody, 'status'>> & {
  status?: KpiTypeStatus;
  change_reason?: string;
};

export type ChangeKpiTypeStatusBody = {
  status: KpiTypeStatus;
  reason?: string;
  effective_from?: string;
};

export type DuplicateKpiTypeBody = {
  code: string;
  name?: string;
};

export type ValidateKpiTypeFormulaBody = {
  formula_expression?: string;
  data_source_id?: string;
  test_period?: { from?: string; to?: string; timezone?: string };
};

export type KpiTypeFormulaPreview = {
  value: number | null;
  formatted_value: string | null;
  records_scanned: number | null;
  calculated_at: string;
};

export type KpiTypeValidateFormulaResult = {
  validation_status: KpiTypeValidationStatus;
  message: string;
  preview: KpiTypeFormulaPreview | null;
};

export type KpiTypeVersionRow = {
  id: string;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  formula_expression: string | null;
  formula_display: string | null;
  validation_status: KpiTypeValidationStatus;
  change_reason: string | null;
  created_by_staff_id: number;
  created_at: string;
};

export type KpiTypeSummary = {
  total: number;
  active: number;
  draft: number;
  auto: number;
};

export type KpiTypeAuditRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  performed_by_staff_id: number;
  performed_by_name: string | null;
  performed_at: string;
  ip_address: string | null;
  request_id: string | null;
};

export type KpiTypeAuditQuery = {
  page?: number;
  page_size?: number;
};

export type PaginatedMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type KpiTypeGroupSnapshot = {
  id: string;
  code: string;
  name: string;
  status: string;
  default_direction: KpiTypeDirection;
  suggested_unit_types: string[];
  color: string;
};
