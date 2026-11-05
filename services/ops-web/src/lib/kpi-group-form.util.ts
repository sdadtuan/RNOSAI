import type { KpiGroupDirection, KpiGroupScopeType } from './kpi-group-util';

export const KPI_GROUP_CODE_RE = /^[A-Z0-9_]{3,50}$/;
export const KPI_GROUP_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export type KpiGroupFormValues = {
  code: string;
  name: string;
  description: string;
  scope_type: KpiGroupScopeType;
  department_ids: string[];
  position_ids: number[];
  default_direction: KpiGroupDirection | '';
  suggested_unit_types: string[];
  data_domains: string[];
  color: string;
  icon: string;
  display_order: number | '';
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
};

export type KpiGroupFormFieldErrors = Partial<Record<keyof KpiGroupFormValues | 'form', string>>;

export function normalizeKpiGroupCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

export function validateKpiGroupCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return 'KPI_GROUP_CODE_REQUIRED';
  if (!KPI_GROUP_CODE_RE.test(trimmed)) return 'KPI_GROUP_CODE_INVALID';
  return null;
}

export function validateKpiGroupName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'KPI_GROUP_NAME_REQUIRED';
  if (trimmed.length < 3 || trimmed.length > 100) return 'KPI_GROUP_NAME_REQUIRED';
  return null;
}

export function validateKpiGroupColor(color: string): string | null {
  if (!KPI_GROUP_COLOR_RE.test(color.trim())) return 'KPI_GROUP_COLOR_INVALID';
  return null;
}

export function validateKpiGroupScope(body: {
  scope_type: KpiGroupScopeType;
  department_ids?: string[];
  position_ids?: number[];
}): string | null {
  if (body.scope_type === 'ORGANIZATION') return null;
  if (body.scope_type === 'DEPARTMENT') {
    if (!body.department_ids?.length) return 'KPI_GROUP_SCOPE_REQUIRED';
    return null;
  }
  if (body.scope_type === 'POSITION') {
    if (!body.department_ids?.length) return 'KPI_GROUP_SCOPE_REQUIRED';
    if (!body.position_ids?.length) return 'KPI_GROUP_SCOPE_REQUIRED';
    return null;
  }
  if (body.scope_type === 'CUSTOM') {
    if (!body.department_ids?.length && !body.position_ids?.length) return 'KPI_GROUP_SCOPE_REQUIRED';
  }
  return null;
}

export function validateKpiGroupDisplayOrder(order: number | ''): string | null {
  if (order === '' || !Number.isInteger(order) || order <= 0) return 'KPI_GROUP_ORDER_INVALID';
  return null;
}

export function validateKpiGroupForm(values: KpiGroupFormValues): KpiGroupFormFieldErrors {
  const errors: KpiGroupFormFieldErrors = {};

  const codeErr = validateKpiGroupCode(values.code);
  if (codeErr) errors.code = codeErr;

  const nameErr = validateKpiGroupName(values.name);
  if (nameErr) errors.name = nameErr;

  if (values.description.length > 500) {
    errors.description = 'Mô tả tối đa 500 ký tự';
  }

  const scopeErr = validateKpiGroupScope({
    scope_type: values.scope_type,
    department_ids: values.department_ids,
    position_ids: values.position_ids,
  });
  if (scopeErr) errors.scope_type = scopeErr;

  if (!values.default_direction) {
    errors.default_direction = 'KPI_GROUP_DIRECTION_REQUIRED';
  }

  const colorErr = validateKpiGroupColor(values.color);
  if (colorErr) errors.color = colorErr;

  const orderErr = validateKpiGroupDisplayOrder(values.display_order);
  if (orderErr) errors.display_order = orderErr;

  return errors;
}

export function isKpiGroupFormValid(values: KpiGroupFormValues): boolean {
  return Object.keys(validateKpiGroupForm(values)).length === 0;
}

export function kpiGroupFormChecklist(values: KpiGroupFormValues): Array<{ id: string; label: string; ok: boolean }> {
  return [
    { id: 'code', label: 'Mã nhóm hợp lệ', ok: !validateKpiGroupCode(values.code) },
    { id: 'name', label: 'Tên nhóm hợp lệ', ok: !validateKpiGroupName(values.name) },
    {
      id: 'scope',
      label: 'Phạm vi áp dụng',
      ok: !validateKpiGroupScope({
        scope_type: values.scope_type,
        department_ids: values.department_ids,
        position_ids: values.position_ids,
      }),
    },
    { id: 'direction', label: 'Hướng đo mặc định', ok: Boolean(values.default_direction) },
    { id: 'color', label: 'Màu nhận diện', ok: !validateKpiGroupColor(values.color) },
    { id: 'order', label: 'Thứ tự hiển thị', ok: !validateKpiGroupDisplayOrder(values.display_order) },
  ];
}

export const DEFAULT_KPI_GROUP_FORM: KpiGroupFormValues = {
  code: '',
  name: '',
  description: '',
  scope_type: 'ORGANIZATION',
  department_ids: [],
  position_ids: [],
  default_direction: 'INCREASE',
  suggested_unit_types: [],
  data_domains: [],
  color: '#17B6A4',
  icon: 'trending-up',
  display_order: 1,
  status: 'DRAFT',
};
