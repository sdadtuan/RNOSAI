import { API_BASE, ApiError, parseJson } from './api';
import type {
  CreateServiceKpiInstanceBody,
  CreateServiceKpiTemplateBody,
  ImportActualRow,
  ImportActualResult,
  IngestActualBody,
  ServiceKpiActualRecord,
  ServiceKpiContractRiskResponse,
  ServiceKpiChangeOrderPreview,
  ServiceKpiChangeOrderResult,
  ServiceKpiContractScoreLive,
  ServiceKpiQuoteContractScore,
  ServiceKpiReconcileSource,
  ServiceKpiTrackingDashboard,
  ServiceKpiInstanceItem,
  ServiceKpiMeasurementPlan,
  ServiceKpiPolicyPack,
  ServiceKpiReconcileRow,
  ServiceKpiTemplatesResponse,
  ServiceKpiOverview,
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

export async function activateServiceKpiTemplateVersion(token: string, versionId: string) {
  return serviceKpiFetch<{ status: string }>(
    token,
    `${BASE}/service-template-versions/${encodeURIComponent(versionId)}/activate`,
    { method: 'POST' },
  );
}

export async function updateServiceKpiTemplateRules(
  token: string,
  versionId: string,
  rules: CreateServiceKpiTemplateBody['rules'],
) {
  return serviceKpiFetch<{ id: string; rules: CreateServiceKpiTemplateBody['rules'] }>(
    token,
    `${BASE}/service-template-versions/${encodeURIComponent(versionId)}/rules`,
    { method: 'PATCH', body: JSON.stringify({ rules }) },
  );
}

export async function fetchServiceKpiMeasurementPlan(token: string, instanceId: string) {
  return serviceKpiFetch<ServiceKpiMeasurementPlan>(
    token,
    `${BASE}/instances/${encodeURIComponent(instanceId)}/measurement-plan`,
  );
}

export async function fetchServiceKpiActuals(token: string, instanceId: string) {
  return serviceKpiFetch<ServiceKpiActualRecord[]>(
    token,
    `${BASE}/instances/${encodeURIComponent(instanceId)}/actuals`,
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

export async function createServiceKpiInstance(token: string, body: CreateServiceKpiInstanceBody) {
  return serviceKpiFetch<ServiceKpiInstanceItem>(token, `${BASE}/instances`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

export async function fetchServiceKpiOverview(token: string) {
  return serviceKpiFetch<ServiceKpiOverview>(token, `${BASE}/service-kpi/overview`);
}

export async function fetchServiceKpiWarRoom(token: string) {
  return serviceKpiFetch<ServiceKpiWarRoomData>(token, `${BASE}/service-kpi/war-room`);
}

export async function fetchServiceKpiTrackingDashboard(token: string, highlightInstanceId?: string) {
  return serviceKpiFetch<ServiceKpiTrackingDashboard>(
    token,
    `${BASE}/service-kpi/tracking${buildQuery({ instance: highlightInstanceId })}`,
  );
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

export async function importServiceKpiActuals(token: string, rows: ImportActualRow[]) {
  return serviceKpiFetch<ImportActualResult>(token, `${BASE}/actuals/import`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export async function fetchServiceKpiContractRisk(token: string, versionId?: string, gmBps?: number) {
  return serviceKpiFetch<ServiceKpiContractRiskResponse>(
    token,
    `${BASE}/service-kpi/contract-risk${buildQuery({ version_id: versionId, gm_bps: gmBps })}`,
  );
}

export async function fetchServiceKpiContractQuotes(token: string) {
  return serviceKpiFetch<{ items: ServiceKpiQuoteContractScore[] }>(token, `${BASE}/service-kpi/contract-quotes`);
}

export async function fetchServiceKpiContractScoreLive(token: string, versionId: string, gmBps?: number | null) {
  return serviceKpiFetch<ServiceKpiContractScoreLive>(
    token,
    `${BASE}/service-kpi/contract-risk${buildQuery({ version_id: versionId, gm_bps: gmBps ?? undefined })}`,
  );
}

export async function fetchServiceKpiReconcileSources(token: string) {
  return serviceKpiFetch<{ items: ServiceKpiReconcileSource[] }>(token, `${BASE}/reconcile/sources`);
}

export async function previewServiceKpiChangeOrder(token: string, sourceId: string) {
  return serviceKpiFetch<ServiceKpiChangeOrderPreview>(
    token,
    `${BASE}/reconcile/change-order/preview${buildQuery({ source_id: sourceId })}`,
  );
}

export async function createServiceKpiChangeOrder(
  token: string,
  body: { source_id: string; reason?: string },
) {
  return serviceKpiFetch<ServiceKpiChangeOrderResult>(token, `${BASE}/reconcile/change-order`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function validateServiceKpiInstanceReadiness(token: string, instanceId: string) {
  return serviceKpiFetch<{ level: string; errors: Array<{ field: string; message: string }> }>(
    token,
    `${BASE}/instances/${encodeURIComponent(instanceId)}/validate-readiness`,
    { method: 'POST' },
  );
}
