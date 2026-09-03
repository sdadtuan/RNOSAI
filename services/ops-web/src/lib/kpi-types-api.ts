import { API_BASE, ApiError, parseJson } from './api';
import type {
  KpiTypeCalculationMode,
  KpiTypeDirection,
  KpiTypeStatus,
  KpiTypeTargetMode,
  KpiTypeValidationStatus,
  KpiTypeValueType,
} from './kpi-type-util';
import { kpiTypeErrorMessage } from './kpi-type-util';

export interface KpiTypeRef {
  id: string;
  name: string;
  code?: string;
  color?: string;
}

export interface KpiTypeUnit {
  id: string;
  code: string;
  name: string;
  value_types?: string[];
}

export interface KpiTypeSource {
  id: string;
  code: string;
  name: string;
  adapter_key: string;
  health: string;
  entities?: string[];
}

export interface KpiTypeListItem {
  id: string;
  code: string;
  name: string;
  short_name?: string | null;
  description?: string | null;
  kpi_group: KpiTypeRef | null;
  direction: KpiTypeDirection;
  value_type: KpiTypeValueType;
  unit: KpiTypeUnit | null;
  calculation_mode: KpiTypeCalculationMode;
  data_source: KpiTypeSource | null;
  usage_count: number;
  status: KpiTypeStatus;
  current_version: number;
  display_order: number;
  updated_at: string;
  updated_by?: { id: number; name: string } | null;
  row_version: number;
}

export interface KpiTypeDetail extends KpiTypeListItem {
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
  aggregation_type: string | null;
  formula_expression: string | null;
  formula_display: string | null;
  sync_frequency: string | null;
  timezone: string;
  divide_by_zero_fallback: 'ZERO' | 'NA' | 'ERROR';
  manual_evidence_required: boolean;
  scope_type: string;
  department_ids: number[];
  position_ids: number[];
  weight_min: number | null;
  weight_max: number | null;
  validation_status: KpiTypeValidationStatus;
}

export interface KpiTypeListMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface KpiTypeSummary {
  total: number;
  active: number;
  draft: number;
  auto: number;
}

export type KpiTypeListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  kpi_group_id?: string;
  status?: KpiTypeStatus;
  calculation_mode?: KpiTypeCalculationMode;
  direction?: KpiTypeDirection;
  department_id?: string;
  data_source_id?: string;
  sort?: string;
};

export type CreateKpiTypeBody = Record<string, unknown>;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function parseStaffRef(row: unknown): { id: number; name: string } | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null) return null;
  return { id: Number(r.id), name: String(r.name ?? '') };
}

function parseRef(row: unknown): KpiTypeRef | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null) return null;
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    code: r.code != null ? String(r.code) : undefined,
    color: r.color != null ? String(r.color) : undefined,
  };
}

function parseUnit(row: unknown): KpiTypeUnit | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null) return null;
  return { id: String(r.id), code: String(r.code ?? ''), name: String(r.name ?? '') };
}

function parseSource(row: unknown): KpiTypeSource | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null) return null;
  return {
    id: String(r.id),
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    adapter_key: String(r.adapter_key ?? ''),
    health: String(r.health ?? 'UNKNOWN'),
  };
}

export function parseKpiTypeListItem(row: unknown): KpiTypeListItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null || r.code == null || r.name == null) return null;
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    short_name: r.short_name != null ? String(r.short_name) : null,
    description: r.description != null ? String(r.description) : null,
    kpi_group: parseRef(r.kpi_group),
    direction: String(r.direction) as KpiTypeDirection,
    value_type: String(r.value_type ?? 'INTEGER') as KpiTypeValueType,
    unit: parseUnit(r.unit),
    calculation_mode: String(r.calculation_mode ?? 'MANUAL') as KpiTypeCalculationMode,
    data_source: parseSource(r.data_source),
    usage_count: Number(r.usage_count) || 0,
    status: String(r.status) as KpiTypeStatus,
    current_version: Number(r.current_version) || 1,
    display_order: Number(r.display_order) || 1,
    updated_at: String(r.updated_at ?? ''),
    updated_by: parseStaffRef(r.updated_by),
    row_version: Number(r.row_version) || 1,
  };
}

export function parseKpiTypeList(body: unknown): { data: KpiTypeListItem[]; meta: KpiTypeListMeta } {
  const root = body as Record<string, unknown>;
  const items = Array.isArray(root?.data) ? root.data : Array.isArray(body) ? body : [];
  const data = items.map(parseKpiTypeListItem).filter((r): r is KpiTypeListItem => r != null);
  const metaRaw = (root?.meta ?? {}) as Record<string, unknown>;
  return {
    data,
    meta: {
      page: Number(metaRaw.page) || 1,
      page_size: Number(metaRaw.page_size) || data.length || 20,
      total: Number(metaRaw.total) || data.length,
      total_pages: Number(metaRaw.total_pages) || 1,
    },
  };
}

export function parseKpiTypeDetail(body: unknown): KpiTypeDetail | null {
  const base = parseKpiTypeListItem(body);
  if (!base) return null;
  const r = body as Record<string, unknown>;
  return {
    ...base,
    kpi_group_id: String(r.kpi_group_id ?? base.kpi_group?.id ?? ''),
    unit_id: String(r.unit_id ?? base.unit?.id ?? ''),
    decimal_places: Number(r.decimal_places ?? 0),
    target_mode: String(r.target_mode ?? 'SINGLE_TARGET') as KpiTypeTargetMode,
    minimum_target: r.minimum_target != null ? Number(r.minimum_target) : null,
    default_target: Number(r.default_target ?? 0),
    stretch_target: r.stretch_target != null ? Number(r.stretch_target) : null,
    lower_limit: r.lower_limit != null ? Number(r.lower_limit) : null,
    upper_limit: r.upper_limit != null ? Number(r.upper_limit) : null,
    primary_data_source_id: r.primary_data_source_id != null ? String(r.primary_data_source_id) : null,
    data_entity: r.data_entity != null ? String(r.data_entity) : null,
    aggregation_type: r.aggregation_type != null ? String(r.aggregation_type) : null,
    formula_expression: r.formula_expression != null ? String(r.formula_expression) : null,
    formula_display: r.formula_display != null ? String(r.formula_display) : null,
    sync_frequency: r.sync_frequency != null ? String(r.sync_frequency) : null,
    timezone: String(r.timezone ?? 'Asia/Ho_Chi_Minh'),
    divide_by_zero_fallback: (r.divide_by_zero_fallback as 'ZERO' | 'NA' | 'ERROR') ?? 'ERROR',
    manual_evidence_required: Boolean(r.manual_evidence_required),
    scope_type: String(r.scope_type ?? 'ORGANIZATION'),
    department_ids: Array.isArray(r.department_ids) ? r.department_ids.map(Number) : [],
    position_ids: Array.isArray(r.position_ids) ? r.position_ids.map(Number) : [],
    weight_min: r.weight_min != null ? Number(r.weight_min) : null,
    weight_max: r.weight_max != null ? Number(r.weight_max) : null,
    validation_status: String(r.validation_status ?? 'NOT_TESTED') as KpiTypeValidationStatus,
  };
}

export function parseKpiTypeSummary(body: unknown): KpiTypeSummary {
  const r = (body ?? {}) as Record<string, unknown>;
  return {
    total: Number(r.total) || 0,
    active: Number(r.active) || 0,
    draft: Number(r.draft) || 0,
    auto: Number(r.auto) || 0,
  };
}

async function kpiTypesFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    const code = (body as { error?: string }).error;
    const msg = code ? kpiTypeErrorMessage(code) : body.message ?? 'KPI types request failed';
    throw new ApiError(msg, res.status);
  }
  return body;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchKpiTypes(token: string, query: KpiTypeListQuery = {}) {
  const qs = buildQuery({
    page: query.page,
    page_size: query.page_size,
    q: query.q,
    kpi_group_id: query.kpi_group_id,
    status: query.status,
    calculation_mode: query.calculation_mode,
    direction: query.direction,
    department_id: query.department_id,
    data_source_id: query.data_source_id,
    sort: query.sort,
  });
  return parseKpiTypeList(await kpiTypesFetch(token, `/api/v1/kpi-types${qs}`));
}

export async function fetchKpiTypeSummary(token: string): Promise<KpiTypeSummary> {
  return parseKpiTypeSummary(await kpiTypesFetch(token, '/api/v1/kpi-types/summary'));
}

export async function fetchKpiTypeUnits(token: string): Promise<KpiTypeUnit[]> {
  const body = await kpiTypesFetch<unknown>(token, '/api/v1/kpi-types/units');
  return (Array.isArray(body) ? body : []).map(parseUnit).filter((u): u is KpiTypeUnit => u != null);
}

export async function fetchKpiTypeDataSources(token: string): Promise<KpiTypeSource[]> {
  const body = await kpiTypesFetch<unknown>(token, '/api/v1/kpi-types/data-sources');
  return (Array.isArray(body) ? body : []).map(parseSource).filter((s): s is KpiTypeSource => s != null);
}

export async function fetchKpiType(token: string, id: string): Promise<KpiTypeDetail> {
  const detail = parseKpiTypeDetail(await kpiTypesFetch(token, `/api/v1/kpi-types/${encodeURIComponent(id)}`));
  if (!detail) throw new ApiError('Invalid KPI type response', 500);
  return detail;
}

export async function createKpiType(token: string, body: CreateKpiTypeBody): Promise<KpiTypeDetail> {
  const detail = parseKpiTypeDetail(
    await kpiTypesFetch(token, '/api/v1/kpi-types', { method: 'POST', body: JSON.stringify(body) }),
  );
  if (!detail) throw new ApiError('Invalid KPI type response', 500);
  return detail;
}

export async function patchKpiType(
  token: string,
  id: string,
  body: CreateKpiTypeBody,
  rowVersion?: number,
): Promise<KpiTypeDetail> {
  const headers: Record<string, string> = {};
  if (rowVersion != null) headers['If-Match'] = String(rowVersion);
  const detail = parseKpiTypeDetail(
    await kpiTypesFetch(token, `/api/v1/kpi-types/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    }),
  );
  if (!detail) throw new ApiError('Invalid KPI type response', 500);
  return detail;
}

export async function changeKpiTypeStatus(token: string, id: string, status: KpiTypeStatus, reason?: string) {
  const detail = parseKpiTypeDetail(
    await kpiTypesFetch(token, `/api/v1/kpi-types/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    }),
  );
  if (!detail) throw new ApiError('Invalid KPI type response', 500);
  return detail;
}

export async function duplicateKpiType(token: string, id: string, body: { code: string; name: string }) {
  const detail = parseKpiTypeDetail(
    await kpiTypesFetch(token, `/api/v1/kpi-types/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  if (!detail) throw new ApiError('Invalid KPI type response', 500);
  return detail;
}

export async function deleteKpiType(token: string, id: string): Promise<void> {
  await kpiTypesFetch(token, `/api/v1/kpi-types/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function validateKpiTypeFormula(
  token: string,
  id: string,
  body: { formula_expression?: string; data_source_id?: string } = {},
) {
  return kpiTypesFetch<{
    validation_status: KpiTypeValidationStatus;
    message: string;
    preview: { value: number | null; formatted_value: string | null; records_scanned: number | null } | null;
  }>(token, `/api/v1/kpi-types/${encodeURIComponent(id)}/validate-formula`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchKpiTypeVersions(token: string, id: string) {
  const body = await kpiTypesFetch<{ data?: unknown[] }>(
    token,
    `/api/v1/kpi-types/${encodeURIComponent(id)}/versions`,
  );
  return Array.isArray(body.data) ? body.data : [];
}

export async function fetchKpiTypeAudit(token: string, id: string) {
  return kpiTypesFetch<{ data: unknown[] }>(token, `/api/v1/kpi-types/${encodeURIComponent(id)}/audit`);
}
