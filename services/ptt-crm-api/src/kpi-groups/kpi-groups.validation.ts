import {
  KPI_GROUP_DATA_DOMAINS,
  KPI_GROUP_DIRECTIONS,
  KPI_GROUP_ERROR_CODES,
  KPI_GROUP_SCOPE_TYPES,
  KPI_GROUP_STATUSES,
  KPI_GROUP_UNIT_TYPES,
  type CreateKpiGroupBody,
  type KpiGroupDirection,
  type KpiGroupScopeType,
  type KpiGroupStatus,
  type PatchKpiGroupBody,
} from './kpi-groups.types';

export const KPI_GROUP_CODE_RE = /^[A-Z0-9_]{3,50}$/;
export const KPI_GROUP_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function validateKpiGroupCode(code: string | undefined | null): string | null {
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return KPI_GROUP_ERROR_CODES.CODE_REQUIRED;
  if (!KPI_GROUP_CODE_RE.test(trimmed)) return KPI_GROUP_ERROR_CODES.CODE_INVALID;
  return null;
}

export function validateKpiGroupName(name: string | undefined | null): string | null {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length < 3 || trimmed.length > 100) return KPI_GROUP_ERROR_CODES.NAME_REQUIRED;
  return null;
}

export function validateKpiGroupColor(color: string | undefined | null): boolean {
  return KPI_GROUP_COLOR_RE.test(String(color ?? '').trim());
}

export function validateKpiGroupDirection(
  direction: string | undefined | null,
): string | null {
  if (!direction || !KPI_GROUP_DIRECTIONS.includes(direction as KpiGroupDirection)) {
    return KPI_GROUP_ERROR_CODES.DIRECTION_REQUIRED;
  }
  return null;
}

export function validateKpiGroupStatus(status: string | undefined | null): string | null {
  if (!status || !KPI_GROUP_STATUSES.includes(status as KpiGroupStatus)) {
    return KPI_GROUP_ERROR_CODES.STATUS_INVALID;
  }
  return null;
}

export function validateKpiGroupScope(body: {
  scope_type: string;
  department_ids?: number[];
  position_ids?: number[];
}): string | null {
  if (!body.scope_type || !KPI_GROUP_SCOPE_TYPES.includes(body.scope_type as KpiGroupScopeType)) {
    return KPI_GROUP_ERROR_CODES.SCOPE_REQUIRED;
  }
  const deptIds = body.department_ids ?? [];
  const posIds = body.position_ids ?? [];
  if (body.scope_type === 'DEPARTMENT' && deptIds.length === 0) {
    return KPI_GROUP_ERROR_CODES.SCOPE_REQUIRED;
  }
  if (body.scope_type === 'POSITION' && deptIds.length === 0 && posIds.length === 0) {
    return KPI_GROUP_ERROR_CODES.SCOPE_REQUIRED;
  }
  return null;
}

export function validateKpiGroupDisplayOrder(order: unknown): string | null {
  const n = Number(order);
  if (!Number.isInteger(n) || n <= 0) return KPI_GROUP_ERROR_CODES.ORDER_INVALID;
  return null;
}

export function validateKpiGroupUnitTypes(values: string[] | undefined): string[] {
  const allowed = new Set<string>(KPI_GROUP_UNIT_TYPES);
  return (values ?? []).filter((v) => allowed.has(String(v).trim().toUpperCase()));
}

export function validateKpiGroupDataDomains(values: string[] | undefined): string[] {
  const allowed = new Set<string>(KPI_GROUP_DATA_DOMAINS);
  return (values ?? []).filter((v) => allowed.has(String(v).trim().toUpperCase()));
}

export function validateCreateKpiGroupBody(body: CreateKpiGroupBody): string | null {
  const codeErr = validateKpiGroupCode(body.code);
  if (codeErr) return codeErr;
  const nameErr = validateKpiGroupName(body.name);
  if (nameErr) return nameErr;
  const dirErr = validateKpiGroupDirection(body.default_direction);
  if (dirErr) return dirErr;
  const scopeErr = validateKpiGroupScope({
    scope_type: body.scope_type,
    department_ids: body.department_ids,
    position_ids: body.position_ids,
  });
  if (scopeErr) return scopeErr;
  if (body.color != null && !validateKpiGroupColor(body.color)) {
    return KPI_GROUP_ERROR_CODES.COLOR_INVALID;
  }
  if (body.display_order != null) {
    const orderErr = validateKpiGroupDisplayOrder(body.display_order);
    if (orderErr) return orderErr;
  }
  if (body.status != null) {
    const statusErr = validateKpiGroupStatus(body.status);
    if (statusErr) return statusErr;
  }
  return null;
}

export function validatePatchKpiGroupBody(body: PatchKpiGroupBody): string | null {
  if ('code' in body && body.code != null) {
    const codeErr = validateKpiGroupCode(body.code);
    if (codeErr) return codeErr;
  }
  if ('name' in body && body.name != null) {
    const nameErr = validateKpiGroupName(body.name);
    if (nameErr) return nameErr;
  }
  if ('default_direction' in body && body.default_direction != null) {
    const dirErr = validateKpiGroupDirection(body.default_direction);
    if (dirErr) return dirErr;
  }
  if ('scope_type' in body && body.scope_type != null) {
    const scopeErr = validateKpiGroupScope({
      scope_type: body.scope_type,
      department_ids: body.department_ids,
      position_ids: body.position_ids,
    });
    if (scopeErr) return scopeErr;
  }
  if ('color' in body && body.color != null && !validateKpiGroupColor(body.color)) {
    return KPI_GROUP_ERROR_CODES.COLOR_INVALID;
  }
  if ('display_order' in body && body.display_order != null) {
    const orderErr = validateKpiGroupDisplayOrder(body.display_order);
    if (orderErr) return orderErr;
  }
  if ('status' in body && body.status != null) {
    const statusErr = validateKpiGroupStatus(body.status);
    if (statusErr) return statusErr;
  }
  return null;
}

export function normalizeKpiGroupScopeType(scopeType: KpiGroupScopeType): KpiGroupScopeType {
  return scopeType;
}

export function effectiveScopeDepartmentIds(
  scopeType: KpiGroupScopeType,
  departmentIds: number[] | undefined,
): number[] {
  if (scopeType === 'ORGANIZATION') return [];
  return departmentIds ?? [];
}

export function effectiveScopePositionIds(
  scopeType: KpiGroupScopeType,
  positionIds: number[] | undefined,
): number[] {
  if (scopeType === 'ORGANIZATION') return [];
  return positionIds ?? [];
}

export function isValidStatusTransition(from: KpiGroupStatus, to: KpiGroupStatus): boolean {
  if (from === to) return true;
  if (from === 'DRAFT' && to === 'ACTIVE') return true;
  if (from === 'ACTIVE' && to === 'INACTIVE') return true;
  if (from === 'INACTIVE' && to === 'ACTIVE') return true;
  return false;
}
