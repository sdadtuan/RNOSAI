import { API_BASE, ApiError, parseJson } from './api';
import type { KpiGroupDirection, KpiGroupScopeType, KpiGroupStatus } from './kpi-group-util';
import { kpiGroupErrorMessage } from './kpi-group-util';

export interface KpiGroupRef {
  id: string;
  name: string;
}

export interface KpiGroupListItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  scope_type: KpiGroupScopeType;
  departments: KpiGroupRef[];
  positions?: KpiGroupRef[];
  default_direction: KpiGroupDirection;
  color: string;
  icon?: string | null;
  display_order: number;
  status: KpiGroupStatus;
  usage_count: number;
  updated_at: string;
  updated_by?: { id: number; name: string } | null;
  is_system_default?: boolean;
}

export interface KpiGroupDetail extends KpiGroupListItem {
  department_ids: string[];
  position_ids: number[];
  suggested_unit_types: string[];
  data_domains: string[];
  row_version: number;
  created_at?: string;
  created_by?: { id: number; name: string } | null;
}

export interface KpiGroupListMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface KpiGroupListResponse {
  data: KpiGroupListItem[];
  meta: KpiGroupListMeta;
}

export interface KpiGroupSummary {
  total: number;
  active: number;
  draft: number;
  inactive: number;
}

export interface KpiGroupAuditEntry {
  id: string;
  action: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  performed_by: { id: number; name: string };
  performed_at: string;
}

export interface KpiGroupAuditResponse {
  data: KpiGroupAuditEntry[];
  meta?: { page: number; page_size: number; total: number };
}

export type KpiGroupListQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  status?: KpiGroupStatus;
  department_id?: string;
  scope_type?: KpiGroupScopeType;
  sort?: string;
};

export type CreateKpiGroupBody = {
  code: string;
  name: string;
  description?: string;
  scope_type: KpiGroupScopeType;
  department_ids?: string[];
  position_ids?: number[];
  default_direction: KpiGroupDirection;
  suggested_unit_types?: string[];
  data_domains?: string[];
  color: string;
  icon?: string;
  display_order?: number;
  status?: KpiGroupStatus;
};

export type PatchKpiGroupBody = Partial<CreateKpiGroupBody>;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function parseRef(row: unknown): KpiGroupRef | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null || r.name == null) return null;
  return { id: String(r.id), name: String(r.name) };
}

function parseStaffRef(row: unknown): { id: number; name: string } | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null) return null;
  return { id: Number(r.id), name: String(r.name ?? '') };
}

export function parseKpiGroupListItem(row: unknown): KpiGroupListItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.id == null || r.code == null || r.name == null) return null;
  const departments = Array.isArray(r.departments)
    ? r.departments.map(parseRef).filter((d): d is KpiGroupRef => d != null)
    : [];
  const positions = Array.isArray(r.positions)
    ? r.positions.map(parseRef).filter((p): p is KpiGroupRef => p != null)
    : [];
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    scope_type: String(r.scope_type) as KpiGroupScopeType,
    departments,
    positions,
    default_direction: String(r.default_direction) as KpiGroupDirection,
    color: String(r.color ?? '#17B6A4'),
    icon: r.icon != null ? String(r.icon) : null,
    display_order: Number(r.display_order) || 1,
    status: String(r.status) as KpiGroupStatus,
    usage_count: Number(r.usage_count) || 0,
    updated_at: String(r.updated_at ?? ''),
    updated_by: parseStaffRef(r.updated_by),
    is_system_default: Boolean(r.is_system_default),
  };
}

export function parseKpiGroupList(body: unknown): KpiGroupListResponse {
  const root = body as Record<string, unknown>;
  const items = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(root?.items)
      ? root.items
      : Array.isArray(body)
        ? body
        : [];
  const data = items.map(parseKpiGroupListItem).filter((r): r is KpiGroupListItem => r != null);
  const metaRaw = (root?.meta ?? {}) as Record<string, unknown>;
  const meta: KpiGroupListMeta = {
    page: Number(metaRaw.page) || 1,
    page_size: Number(metaRaw.page_size) || data.length || 20,
    total: Number(metaRaw.total) || data.length,
    total_pages: Number(metaRaw.total_pages) || 1,
  };
  return { data, meta };
}

export function parseKpiGroupDetail(body: unknown): KpiGroupDetail | null {
  const base = parseKpiGroupListItem(body);
  if (!base) return null;
  const r = body as Record<string, unknown>;
  return {
    ...base,
    department_ids: Array.isArray(r.department_ids)
      ? r.department_ids.map(String)
      : base.departments.map((d) => d.id),
    position_ids: Array.isArray(r.position_ids) ? r.position_ids.map(Number) : [],
    suggested_unit_types: Array.isArray(r.suggested_unit_types) ? r.suggested_unit_types.map(String) : [],
    data_domains: Array.isArray(r.data_domains) ? r.data_domains.map(String) : [],
    row_version: Number(r.row_version) || 1,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    created_by: parseStaffRef(r.created_by),
  };
}

export function parseKpiGroupSummary(body: unknown): KpiGroupSummary {
  const r = (body ?? {}) as Record<string, unknown>;
  return {
    total: Number(r.total) || 0,
    active: Number(r.active) || 0,
    draft: Number(r.draft) || 0,
    inactive: Number(r.inactive) || 0,
  };
}

export function parseKpiGroupAudit(body: unknown): KpiGroupAuditResponse {
  const root = body as Record<string, unknown>;
  const items = Array.isArray(root?.data) ? root.data : Array.isArray(body) ? body : [];
  const data = items
    .map((row): KpiGroupAuditEntry | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const performer = parseStaffRef(r.performed_by ?? r.updated_by);
      if (!r.id || !performer) return null;
      return {
        id: String(r.id),
        action: String(r.action ?? ''),
        before_json: (r.before_json as Record<string, unknown> | null) ?? null,
        after_json: (r.after_json as Record<string, unknown> | null) ?? null,
        performed_by: performer,
        performed_at: String(r.performed_at ?? r.created_at ?? ''),
      };
    })
    .filter((e): e is KpiGroupAuditEntry => e != null);
  const metaRaw = root?.meta as Record<string, unknown> | undefined;
  return {
    data,
    meta: metaRaw
      ? {
          page: Number(metaRaw.page) || 1,
          page_size: Number(metaRaw.page_size) || data.length,
          total: Number(metaRaw.total) || data.length,
        }
      : undefined,
  };
}

async function kpiGroupsFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string; code?: string }>(res);
  if (!res.ok) {
    const code = (body as { code?: string }).code;
    const msg = code ? kpiGroupErrorMessage(code) : body.error ?? body.message ?? 'KPI groups request failed';
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

export async function fetchKpiGroups(token: string, query: KpiGroupListQuery = {}): Promise<KpiGroupListResponse> {
  const qs = buildQuery({
    page: query.page,
    page_size: query.page_size,
    q: query.q,
    status: query.status,
    department_id: query.department_id,
    scope_type: query.scope_type,
    sort: query.sort,
  });
  const body = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups${qs}`);
  return parseKpiGroupList(body);
}

export async function fetchKpiGroupSummary(token: string): Promise<KpiGroupSummary> {
  const body = await kpiGroupsFetch<unknown>(token, '/api/v1/kpi-groups/summary');
  return parseKpiGroupSummary(body);
}

export async function fetchKpiGroup(token: string, id: string): Promise<KpiGroupDetail> {
  const body = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}`);
  const detail = parseKpiGroupDetail(body);
  if (!detail) throw new ApiError('Invalid KPI group response', 500);
  return detail;
}

export async function createKpiGroup(token: string, body: CreateKpiGroupBody): Promise<KpiGroupDetail> {
  const res = await kpiGroupsFetch<unknown>(token, '/api/v1/kpi-groups', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const detail = parseKpiGroupDetail(res);
  if (!detail) throw new ApiError('Invalid KPI group response', 500);
  return detail;
}

export async function patchKpiGroup(
  token: string,
  id: string,
  body: PatchKpiGroupBody,
  rowVersion?: number,
): Promise<KpiGroupDetail> {
  const headers: Record<string, string> = {};
  if (rowVersion != null) headers['If-Match'] = String(rowVersion);
  const res = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const detail = parseKpiGroupDetail(res);
  if (!detail) throw new ApiError('Invalid KPI group response', 500);
  return detail;
}

export async function changeKpiGroupStatus(
  token: string,
  id: string,
  status: KpiGroupStatus,
  reason?: string,
): Promise<KpiGroupDetail> {
  const res = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, reason }),
  });
  const detail = parseKpiGroupDetail(res);
  if (!detail) throw new ApiError('Invalid KPI group response', 500);
  return detail;
}

export async function duplicateKpiGroup(
  token: string,
  id: string,
  body: { code: string; name: string },
): Promise<KpiGroupDetail> {
  const res = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const detail = parseKpiGroupDetail(res);
  if (!detail) throw new ApiError('Invalid KPI group response', 500);
  return detail;
}

export async function deleteKpiGroup(token: string, id: string): Promise<void> {
  await kpiGroupsFetch(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function reorderKpiGroups(
  token: string,
  items: Array<{ id: string; display_order: number }>,
): Promise<{ ok: true }> {
  return kpiGroupsFetch(token, '/api/v1/kpi-groups/display-order', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export interface ImportKpiGroupRowResult {
  row_index: number;
  code?: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface ImportKpiGroupsResult {
  created: number;
  failed: number;
  results: ImportKpiGroupRowResult[];
}

export async function importKpiGroups(
  token: string,
  rows: CreateKpiGroupBody[],
): Promise<ImportKpiGroupsResult> {
  const normalized = rows.map((row) => ({
    ...row,
    department_ids: row.department_ids?.map((id) => Number(id)).filter((n) => Number.isFinite(n)),
  }));
  return kpiGroupsFetch<ImportKpiGroupsResult>(token, '/api/v1/kpi-groups/import', {
    method: 'POST',
    body: JSON.stringify({ rows: normalized }),
  });
}

export async function fetchKpiGroupAudit(
  token: string,
  id: string,
  page = 1,
  pageSize = 20,
): Promise<KpiGroupAuditResponse> {
  const qs = buildQuery({ page, page_size: pageSize });
  const body = await kpiGroupsFetch<unknown>(token, `/api/v1/kpi-groups/${encodeURIComponent(id)}/audit${qs}`);
  return parseKpiGroupAudit(body);
}
