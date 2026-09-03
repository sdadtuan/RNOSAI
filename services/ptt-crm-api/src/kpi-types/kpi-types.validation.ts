import {
  KPI_TYPE_AGGREGATIONS,
  KPI_TYPE_CALCULATION_MODES,
  KPI_TYPE_DIRECTIONS,
  KPI_TYPE_DIVIDE_BY_ZERO,
  KPI_TYPE_ERROR_CODES,
  KPI_TYPE_SCOPE_TYPES,
  KPI_TYPE_STATUSES,
  KPI_TYPE_SYNC_FREQUENCIES,
  KPI_TYPE_TARGET_MODES,
  KPI_TYPE_VALUE_TYPES,
  type CreateKpiTypeBody,
  type KpiTypeCalculationMode,
  type KpiTypeDirection,
  type KpiTypeScopeType,
  type KpiTypeStatus,
  type KpiTypeTargetMode,
  type KpiTypeValueType,
  type PatchKpiTypeBody,
} from './kpi-types.types';

export const KPI_TYPE_CODE_RE = /^[A-Z0-9_]{3,80}$/;

export function validateKpiTypeCode(code: string | undefined | null): string | null {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return KPI_TYPE_ERROR_CODES.CODE_REQUIRED;
  if (!KPI_TYPE_CODE_RE.test(trimmed)) return KPI_TYPE_ERROR_CODES.CODE_INVALID;
  return null;
}

export function validateKpiTypeName(name: string | undefined | null): string | null {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length < 3 || trimmed.length > 150) return KPI_TYPE_ERROR_CODES.NAME_REQUIRED;
  return null;
}

export function validateKpiTypeGroupId(id: string | undefined | null): string | null {
  if (!String(id ?? '').trim()) return KPI_TYPE_ERROR_CODES.GROUP_REQUIRED;
  return null;
}

export function validateKpiTypeUnitId(id: string | undefined | null): string | null {
  if (!String(id ?? '').trim()) return KPI_TYPE_ERROR_CODES.UNIT_REQUIRED;
  return null;
}

export function validateKpiTypeWeights(
  weightMin: number | null | undefined,
  weightMax: number | null | undefined,
): string | null {
  if (weightMin == null && weightMax == null) return null;
  if (weightMin != null && (!Number.isFinite(weightMin) || weightMin < 0 || weightMin > 100)) {
    return KPI_TYPE_ERROR_CODES.WEIGHT_INVALID;
  }
  if (weightMax != null && (!Number.isFinite(weightMax) || weightMax < 0 || weightMax > 100)) {
    return KPI_TYPE_ERROR_CODES.WEIGHT_INVALID;
  }
  if (weightMin != null && weightMax != null && weightMax < weightMin) {
    return KPI_TYPE_ERROR_CODES.WEIGHT_INVALID;
  }
  return null;
}

export function validateKpiTypeTargets(input: {
  direction: string;
  target_mode: string;
  minimum_target?: number | null;
  default_target?: number | null;
  stretch_target?: number | null;
  lower_limit?: number | null;
  upper_limit?: number | null;
}): string | null {
  const direction = input.direction as KpiTypeDirection;
  const mode = input.target_mode as KpiTypeTargetMode;
  if (!KPI_TYPE_DIRECTIONS.includes(direction)) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
  if (!KPI_TYPE_TARGET_MODES.includes(mode)) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;

  const def = input.default_target;
  if (def == null || !Number.isFinite(Number(def))) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;

  const min = input.minimum_target == null ? null : Number(input.minimum_target);
  const stretch = input.stretch_target == null ? null : Number(input.stretch_target);
  const lower = input.lower_limit == null ? null : Number(input.lower_limit);
  const upper = input.upper_limit == null ? null : Number(input.upper_limit);
  const defaultN = Number(def);

  if (mode === 'RANGE') {
    if (lower == null || upper == null || !Number.isFinite(lower) || !Number.isFinite(upper)) {
      return KPI_TYPE_ERROR_CODES.RANGE_INVALID;
    }
    if (lower > upper) return KPI_TYPE_ERROR_CODES.RANGE_INVALID;
    if (defaultN < lower || defaultN > upper) return KPI_TYPE_ERROR_CODES.RANGE_INVALID;
    return null;
  }

  if (mode === 'THRESHOLD') {
    if (min == null || !Number.isFinite(min)) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
    if (direction === 'INCREASE') {
      if (min > defaultN) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
      if (stretch != null && Number.isFinite(stretch) && stretch < defaultN) {
        return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
      }
    }
    if (direction === 'DECREASE') {
      if (min < defaultN) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
      if (stretch != null && Number.isFinite(stretch) && stretch > defaultN) {
        return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
      }
    }
  }

  return null;
}

export function validateKpiTypeScope(body: {
  scope_type: string;
  department_ids?: number[];
  position_ids?: number[];
}): string | null {
  if (!body.scope_type || !KPI_TYPE_SCOPE_TYPES.includes(body.scope_type as KpiTypeScopeType)) {
    return KPI_TYPE_ERROR_CODES.SCOPE_REQUIRED;
  }
  const deptIds = body.department_ids ?? [];
  const posIds = body.position_ids ?? [];
  if (body.scope_type === 'DEPARTMENT' && deptIds.length === 0) {
    return KPI_TYPE_ERROR_CODES.SCOPE_REQUIRED;
  }
  if (body.scope_type === 'POSITION' && deptIds.length === 0 && posIds.length === 0) {
    return KPI_TYPE_ERROR_CODES.SCOPE_REQUIRED;
  }
  return null;
}

export function validateKpiTypeCalculation(body: {
  calculation_mode: string;
  primary_data_source_id?: string | null;
  formula_expression?: string | null;
}): string | null {
  if (!KPI_TYPE_CALCULATION_MODES.includes(body.calculation_mode as KpiTypeCalculationMode)) {
    return KPI_TYPE_ERROR_CODES.AUTO_SOURCE_REQUIRED;
  }
  if (body.calculation_mode === 'MANUAL') return null;
  if (!String(body.primary_data_source_id ?? '').trim()) {
    return KPI_TYPE_ERROR_CODES.AUTO_SOURCE_REQUIRED;
  }
  if (!String(body.formula_expression ?? '').trim()) {
    return KPI_TYPE_ERROR_CODES.FORMULA_REQUIRED;
  }
  return null;
}

export function validateKpiTypeStatus(status: string | undefined | null): string | null {
  if (!status || !KPI_TYPE_STATUSES.includes(status as KpiTypeStatus)) {
    return KPI_TYPE_ERROR_CODES.STATUS_INVALID;
  }
  return null;
}

export function validateKpiTypeDisplayOrder(order: unknown): string | null {
  const n = Number(order);
  if (!Number.isInteger(n) || n <= 0) return KPI_TYPE_ERROR_CODES.STATUS_INVALID;
  return null;
}

export function defaultDecimalPlaces(valueType: KpiTypeValueType): number {
  if (valueType === 'INTEGER' || valueType === 'BOOLEAN' || valueType === 'SCORE') return 0;
  return 2;
}

export function validateCreateKpiTypeBody(body: CreateKpiTypeBody): string | null {
  const groupErr = validateKpiTypeGroupId(body.kpi_group_id);
  if (groupErr) return groupErr;
  const codeErr = validateKpiTypeCode(body.code);
  if (codeErr) return codeErr;
  const nameErr = validateKpiTypeName(body.name);
  if (nameErr) return nameErr;
  if (body.short_name != null && String(body.short_name).length > 50) {
    return KPI_TYPE_ERROR_CODES.NAME_REQUIRED;
  }
  if (body.description != null && String(body.description).length > 1000) {
    return KPI_TYPE_ERROR_CODES.NAME_REQUIRED;
  }
  if (!KPI_TYPE_DIRECTIONS.includes(body.direction)) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
  if (!KPI_TYPE_VALUE_TYPES.includes(body.value_type as KpiTypeValueType)) {
    return KPI_TYPE_ERROR_CODES.UNIT_REQUIRED;
  }
  const unitErr = validateKpiTypeUnitId(body.unit_id);
  if (unitErr) return unitErr;
  if (body.decimal_places != null) {
    const dp = Number(body.decimal_places);
    if (!Number.isInteger(dp) || dp < 0 || dp > 4) return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
  }
  const targetErr = validateKpiTypeTargets(body);
  if (targetErr) return targetErr;
  const calcErr = validateKpiTypeCalculation(body);
  if (calcErr) return calcErr;
  if (body.aggregation_type != null && !KPI_TYPE_AGGREGATIONS.includes(body.aggregation_type)) {
    return KPI_TYPE_ERROR_CODES.FORMULA_INVALID;
  }
  if (body.sync_frequency != null && !KPI_TYPE_SYNC_FREQUENCIES.includes(body.sync_frequency)) {
    return KPI_TYPE_ERROR_CODES.AUTO_SOURCE_REQUIRED;
  }
  if (
    body.divide_by_zero_fallback != null &&
    !KPI_TYPE_DIVIDE_BY_ZERO.includes(body.divide_by_zero_fallback)
  ) {
    return KPI_TYPE_ERROR_CODES.TARGET_INVALID;
  }
  const scopeErr = validateKpiTypeScope({
    scope_type: body.scope_type,
    department_ids: body.department_ids,
    position_ids: body.position_ids,
  });
  if (scopeErr) return scopeErr;
  const weightErr = validateKpiTypeWeights(body.weight_min, body.weight_max);
  if (weightErr) return weightErr;
  if (body.display_order != null) {
    const n = Number(body.display_order);
    if (!Number.isInteger(n) || n <= 0) return KPI_TYPE_ERROR_CODES.STATUS_INVALID;
  }
  if (body.status != null) {
    const statusErr = validateKpiTypeStatus(body.status);
    if (statusErr) return statusErr;
  }
  return null;
}

export function validatePatchKpiTypeBody(body: PatchKpiTypeBody): string | null {
  if ('code' in body && body.code != null) {
    const codeErr = validateKpiTypeCode(body.code);
    if (codeErr) return codeErr;
  }
  if ('name' in body && body.name != null) {
    const nameErr = validateKpiTypeName(body.name);
    if (nameErr) return nameErr;
  }
  if ('kpi_group_id' in body) {
    const groupErr = validateKpiTypeGroupId(body.kpi_group_id);
    if (groupErr) return groupErr;
  }
  if ('unit_id' in body && body.unit_id != null) {
    const unitErr = validateKpiTypeUnitId(body.unit_id);
    if (unitErr) return unitErr;
  }
  if (
    body.direction != null ||
    body.target_mode != null ||
    body.default_target != null ||
    body.minimum_target !== undefined ||
    body.stretch_target !== undefined ||
    body.lower_limit !== undefined ||
    body.upper_limit !== undefined
  ) {
    if (body.direction && body.target_mode && body.default_target != null) {
      const targetErr = validateKpiTypeTargets({
        direction: body.direction,
        target_mode: body.target_mode,
        minimum_target: body.minimum_target,
        default_target: body.default_target,
        stretch_target: body.stretch_target,
        lower_limit: body.lower_limit,
        upper_limit: body.upper_limit,
      });
      if (targetErr) return targetErr;
    }
  }
  if (body.calculation_mode != null) {
    const calcErr = validateKpiTypeCalculation({
      calculation_mode: body.calculation_mode,
      primary_data_source_id: body.primary_data_source_id,
      formula_expression: body.formula_expression,
    });
    if (calcErr) return calcErr;
  }
  if (body.scope_type != null) {
    const scopeErr = validateKpiTypeScope({
      scope_type: body.scope_type,
      department_ids: body.department_ids,
      position_ids: body.position_ids,
    });
    if (scopeErr) return scopeErr;
  }
  if (body.weight_min !== undefined || body.weight_max !== undefined) {
    const weightErr = validateKpiTypeWeights(body.weight_min, body.weight_max);
    if (weightErr) return weightErr;
  }
  if (body.status != null) {
    const statusErr = validateKpiTypeStatus(body.status);
    if (statusErr) return statusErr;
  }
  return null;
}

export function effectiveScopeDepartmentIds(
  scopeType: KpiTypeScopeType,
  departmentIds: number[] | undefined,
): number[] {
  if (scopeType === 'ORGANIZATION') return [];
  return departmentIds ?? [];
}

export function effectiveScopePositionIds(
  scopeType: KpiTypeScopeType,
  positionIds: number[] | undefined,
): number[] {
  if (scopeType === 'ORGANIZATION') return [];
  return positionIds ?? [];
}

export function isValidStatusTransition(from: KpiTypeStatus, to: KpiTypeStatus): boolean {
  if (from === to) return true;
  if (from === 'DRAFT' && to === 'ACTIVE') return true;
  if (from === 'ACTIVE' && to === 'INACTIVE') return true;
  if (from === 'INACTIVE' && to === 'ACTIVE') return true;
  return false;
}

export function isVersionedFieldChange(patch: PatchKpiTypeBody): boolean {
  return (
    patch.formula_expression != null ||
    patch.primary_data_source_id !== undefined ||
    patch.unit_id != null ||
    patch.direction != null ||
    patch.target_mode != null
  );
}
