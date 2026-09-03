import type {
  KpiTypeCalculationMode,
  KpiTypeDirection,
  KpiTypeScopeType,
  KpiTypeStatus,
  KpiTypeTargetMode,
  KpiTypeValueType,
} from './kpi-type-util';

export const KPI_TYPE_CODE_RE = /^[A-Z0-9_]{3,80}$/;

export type KpiTypeFormValues = {
  kpi_group_id: string;
  code: string;
  name: string;
  short_name: string;
  description: string;
  direction: KpiTypeDirection | '';
  value_type: KpiTypeValueType | '';
  unit_id: string;
  decimal_places: number;
  target_mode: KpiTypeTargetMode;
  minimum_target: string;
  default_target: string;
  stretch_target: string;
  lower_limit: string;
  upper_limit: string;
  calculation_mode: KpiTypeCalculationMode;
  primary_data_source_id: string;
  data_entity: string;
  aggregation_type: string;
  formula_expression: string;
  formula_display: string;
  sync_frequency: string;
  divide_by_zero_fallback: 'ZERO' | 'NA' | 'ERROR';
  manual_evidence_required: boolean;
  scope_type: KpiTypeScopeType;
  department_ids: string[];
  position_ids: number[];
  weight_min: string;
  weight_max: string;
  display_order: number | '';
  status: KpiTypeStatus;
};

export type KpiTypeFormFieldErrors = Partial<Record<keyof KpiTypeFormValues | 'form', string>>;

export function normalizeKpiTypeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 80);
}

export function validateKpiTypeCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return 'KPI_TYPE_CODE_REQUIRED';
  if (!KPI_TYPE_CODE_RE.test(trimmed)) return 'KPI_TYPE_CODE_INVALID';
  return null;
}

export function validateKpiTypeName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 150) return 'KPI_TYPE_NAME_REQUIRED';
  return null;
}

function num(raw: string): number | null {
  if (!String(raw).trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function validateKpiTypeTargets(values: KpiTypeFormValues): string | null {
  const def = num(values.default_target);
  if (def == null) return 'KPI_TYPE_TARGET_INVALID';
  if (values.target_mode === 'RANGE') {
    const lower = num(values.lower_limit);
    const upper = num(values.upper_limit);
    if (lower == null || upper == null || lower > upper) return 'KPI_TYPE_RANGE_INVALID';
    if (def < lower || def > upper) return 'KPI_TYPE_RANGE_INVALID';
  }
  if (values.target_mode === 'THRESHOLD') {
    const min = num(values.minimum_target);
    const stretch = num(values.stretch_target);
    if (min == null) return 'KPI_TYPE_TARGET_INVALID';
    if (values.direction === 'INCREASE') {
      if (min > def) return 'KPI_TYPE_TARGET_INVALID';
      if (stretch != null && stretch < def) return 'KPI_TYPE_TARGET_INVALID';
    }
    if (values.direction === 'DECREASE') {
      if (min < def) return 'KPI_TYPE_TARGET_INVALID';
      if (stretch != null && stretch > def) return 'KPI_TYPE_TARGET_INVALID';
    }
  }
  return null;
}

export function validateKpiTypeWeights(minRaw: string, maxRaw: string): string | null {
  const min = num(minRaw);
  const max = num(maxRaw);
  if (min == null && max == null) return null;
  if (min != null && (min < 0 || min > 100)) return 'KPI_TYPE_WEIGHT_INVALID';
  if (max != null && (max < 0 || max > 100)) return 'KPI_TYPE_WEIGHT_INVALID';
  if (min != null && max != null && max < min) return 'KPI_TYPE_WEIGHT_INVALID';
  return null;
}

export function validateKpiTypeForm(values: KpiTypeFormValues): KpiTypeFormFieldErrors {
  const errors: KpiTypeFormFieldErrors = {};
  if (!values.kpi_group_id) errors.kpi_group_id = 'KPI_TYPE_GROUP_REQUIRED';
  const codeErr = validateKpiTypeCode(values.code);
  if (codeErr) errors.code = codeErr;
  const nameErr = validateKpiTypeName(values.name);
  if (nameErr) errors.name = nameErr;
  if (values.description.length > 1000) errors.description = 'Mô tả tối đa 1.000 ký tự';
  if (!values.direction) errors.direction = 'KPI_TYPE_TARGET_INVALID';
  if (!values.value_type) errors.value_type = 'KPI_TYPE_UNIT_REQUIRED';
  if (!values.unit_id) errors.unit_id = 'KPI_TYPE_UNIT_REQUIRED';
  const targetErr = validateKpiTypeTargets(values);
  if (targetErr) errors.default_target = targetErr;
  if (values.calculation_mode !== 'MANUAL') {
    if (!values.primary_data_source_id) errors.primary_data_source_id = 'KPI_TYPE_AUTO_SOURCE_REQUIRED';
    if (!values.formula_expression.trim()) errors.formula_expression = 'KPI_TYPE_FORMULA_REQUIRED';
  }
  if (values.scope_type === 'DEPARTMENT' && !values.department_ids.length) {
    errors.scope_type = 'KPI_TYPE_SCOPE_REQUIRED';
  }
  const weightErr = validateKpiTypeWeights(values.weight_min, values.weight_max);
  if (weightErr) errors.weight_min = weightErr;
  if (values.display_order === '' || !Number.isInteger(values.display_order) || values.display_order <= 0) {
    errors.display_order = 'KPI_TYPE_STATUS_INVALID';
  }
  return errors;
}

export function kpiTypeFormChecklist(values: KpiTypeFormValues): Array<{ id: string; label: string; ok: boolean }> {
  const errors = validateKpiTypeForm(values);
  return [
    { id: 'group', label: 'Nhóm KPI', ok: !errors.kpi_group_id },
    { id: 'code', label: 'Mã hợp lệ', ok: !errors.code },
    { id: 'name', label: 'Tên hợp lệ', ok: !errors.name },
    { id: 'unit', label: 'Đơn vị & hướng đo', ok: !errors.unit_id && !errors.direction },
    { id: 'target', label: 'Mục tiêu mặc định', ok: !errors.default_target },
    { id: 'calc', label: 'Cách tính', ok: !errors.primary_data_source_id && !errors.formula_expression },
    { id: 'scope', label: 'Phạm vi áp dụng', ok: !errors.scope_type },
  ];
}

export const DEFAULT_KPI_TYPE_FORM: KpiTypeFormValues = {
  kpi_group_id: '',
  code: '',
  name: '',
  short_name: '',
  description: '',
  direction: 'INCREASE',
  value_type: 'INTEGER',
  unit_id: '',
  decimal_places: 0,
  target_mode: 'THRESHOLD',
  minimum_target: '',
  default_target: '',
  stretch_target: '',
  lower_limit: '',
  upper_limit: '',
  calculation_mode: 'MANUAL',
  primary_data_source_id: '',
  data_entity: '',
  aggregation_type: 'COUNT',
  formula_expression: '',
  formula_display: '',
  sync_frequency: 'DAILY',
  divide_by_zero_fallback: 'ERROR',
  manual_evidence_required: true,
  scope_type: 'ORGANIZATION',
  department_ids: [],
  position_ids: [],
  weight_min: '',
  weight_max: '',
  display_order: 1,
  status: 'DRAFT',
};
