import { API_BASE, ApiError, parseJson } from './api';
import type {
  CreateServiceKpiTemplateBody,
  IngestActualBody,
  ServiceKpiInstanceItem,
  ServiceKpiPolicyPack,
  ServiceKpiReconcileRow,
  ServiceKpiTemplatesResponse,
  ServiceKpiWarRoomData,
} from './service-kpi-types';

const BASE = '/api/crm/kpi-hub';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function serviceKpiFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(code ?? body.message ?? 'Service KPI request failed', res.status);
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

export async function fetchServiceKpiTemplates(
  token: string,
  q?: { dv_code?: string; status?: string; page?: number },
): Promise<ServiceKpiTemplatesResponse> {
  return serviceKpiFetch(token, `${BASE}/service-templates${buildQuery(q ?? {})}`);
}

export async function fetchServiceKpiTemplate(token: string, id: string) {
  return serviceKpiFetch<Record<string, unknown>>(token, `${BASE}/service-templates/${encodeURIComponent(id)}`);
}

export async function createServiceKpiTemplate(token: string, body: CreateServiceKpiTemplateBody) {
  return serviceKpiFetch<{ id: string; status: string; version_id: string }>(token, `${BASE}/service-templates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitServiceKpiTemplateVersion(token: string, versionId: string) {
  return serviceKpiFetch<{ status: string }>(
    token,
    `${BASE}/service-template-versions/${encodeURIComponent(versionId)}/submit`,
    { method: 'POST' },
  );
}

export async function fetchServiceKpiPolicyPacks(token: string) {
  return serviceKpiFetch<ServiceKpiPolicyPack[]>(token, `${BASE}/policy-packs`);
}

export async function fetchServiceKpiPolicyPack(token: string, industry: string) {
  return serviceKpiFetch<ServiceKpiPolicyPack>(
    token,
    `${BASE}/policy-packs/${encodeURIComponent(industry)}`,
  );
}

export async function fetchServiceKpiInstances(
  token: string,
  q?: { source_type?: string; source_id?: string; status?: string; dv_code?: string },
) {
  return serviceKpiFetch<{ items: ServiceKpiInstanceItem[]; total: number }>(
    token,
    `${BASE}/instances${buildQuery(q ?? {})}`,
  );
}

export async function patchServiceKpiInstance(
  token: string,
  id: string,
  body: Record<string, unknown>,
  rowVersion: number,
) {
  return serviceKpiFetch<ServiceKpiInstanceItem>(token, `${BASE}/instances/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'If-Match': String(rowVersion) },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceKpiWarRoom(token: string) {
  return serviceKpiFetch<ServiceKpiWarRoomData>(token, `${BASE}/service-kpi/war-room`);
}

export async function fetchServiceKpiReconcile(token: string, sourceId: string) {
  return serviceKpiFetch<{ source_id: string; rows: ServiceKpiReconcileRow[] }>(
    token,
    `${BASE}/reconcile${buildQuery({ source_id: sourceId })}`,
  );
}

export async function ingestServiceKpiActual(token: string, instanceId: string, body: IngestActualBody) {
  return serviceKpiFetch<Record<string, unknown>>(
    token,
    `${BASE}/instances/${encodeURIComponent(instanceId)}/actuals`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function upsertServiceKpiMeasurementPlan(
  token: string,
  instanceId: string,
  body: Record<string, unknown>,
) {
  return serviceKpiFetch<Record<string, unknown>>(
    token,
    `${BASE}/instances/${encodeURIComponent(instanceId)}/measurement-plan`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
