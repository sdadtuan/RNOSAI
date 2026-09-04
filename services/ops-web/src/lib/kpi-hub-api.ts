import type { CommandCenterQuery, CommandCenterResponse } from './command-center-types';
import { API_BASE, ApiError, parseJson } from './api';

const BASE = '/api/crm/kpi-hub';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function kpiHubFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(code ?? body.message ?? 'KPI Hub request failed', res.status);
  }
  return body;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchKpiHubWorkspace(token: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/workspace`);
}

export async function patchKpiHubWorkspace(
  token: string,
  body: Record<string, unknown>,
  rowVersion?: number,
) {
  const headers: Record<string, string> = {};
  if (rowVersion != null) headers['If-Match'] = String(rowVersion);
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/workspace`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

export async function fetchKpiHubDictionary(token: string, query: Record<string, string> = {}) {
  return kpiHubFetch<{ data: unknown[]; summary?: unknown }>(
    token,
    `${BASE}/dictionary${buildQuery(query)}`,
  );
}

export async function fetchKpiHubDictionaryItem(token: string, id: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/dictionary/${encodeURIComponent(id)}`);
}

export async function createKpiHubDictionary(token: string, body: Record<string, unknown>) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/dictionary`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchKpiHubDictionary(
  token: string,
  id: string,
  body: Record<string, unknown>,
  rowVersion?: number,
) {
  const headers: Record<string, string> = {};
  if (rowVersion != null) headers['If-Match'] = String(rowVersion);
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/dictionary/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

export async function publishKpiHubDictionary(token: string, id: string) {
  return kpiHubFetch<Record<string, unknown>>(
    token,
    `${BASE}/dictionary/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
  );
}

export async function validateKpiHubDictionary(token: string, id: string, body: Record<string, unknown> = {}) {
  return kpiHubFetch<Record<string, unknown>>(
    token,
    `${BASE}/dictionary/${encodeURIComponent(id)}/validate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function fetchKpiHubSources(token: string) {
  return kpiHubFetch<{ data: unknown[] }>(token, `${BASE}/sources`);
}

export async function refreshKpiHubSource(token: string, id: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/sources/${encodeURIComponent(id)}/refresh`, {
    method: 'POST',
  });
}

export async function fetchKpiHubTargets(token: string, query: Record<string, string> = {}) {
  return kpiHubFetch<{ data: unknown[]; summary?: unknown }>(
    token,
    `${BASE}/targets${buildQuery(query)}`,
  );
}

export async function upsertKpiHubTarget(token: string, body: Record<string, unknown>, rowVersion?: number) {
  const headers: Record<string, string> = {};
  if (rowVersion != null) headers['If-Match'] = String(rowVersion);
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/targets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export async function fetchKpiHubAlerts(token: string) {
  return kpiHubFetch<{ data: unknown[] }>(token, `${BASE}/alerts`);
}

export async function ackKpiHubAlert(token: string, id: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/alerts/${encodeURIComponent(id)}/ack`, {
    method: 'POST',
  });
}

export async function fetchKpiHubDashboard(token: string, query: Record<string, string> = {}) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/dashboard${buildQuery(query)}`);
}

export async function fetchKpiHubCommandCenter(
  token: string,
  persona: 'executive' | 'marketing' | 'sales',
  query: CommandCenterQuery = {},
) {
  return kpiHubFetch<CommandCenterResponse>(
    token,
    `${BASE}/dashboard${buildQuery({
      persona,
      from: query.from,
      to: query.to,
      compare: query.compare ? '1' : undefined,
      department_id: query.department_id,
      channel: query.channel,
      product: query.product,
      team_id: query.team_id,
    })}`,
  );
}

export async function fetchKpiHubQuality(token: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/quality`);
}

export async function runKpiHubQualityCheck(token: string) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/quality/run`, { method: 'POST' });
}

export async function fetchKpiHubReports(token: string) {
  return kpiHubFetch<{ data: unknown[]; summary?: unknown }>(token, `${BASE}/reports`);
}

export async function createKpiHubReport(token: string, body: Record<string, unknown>) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/reports`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchKpiHubActivity(token: string) {
  return kpiHubFetch<{ data: unknown[] }>(token, `${BASE}/activity`);
}

export async function fetchDictionaryDependencies(token: string, id: string) {
  return kpiHubFetch<{ upstream: unknown[]; downstream: unknown[] }>(
    token,
    `${BASE}/dictionary/${encodeURIComponent(id)}/dependencies`,
  );
}

export async function previewFormula(token: string, body: Record<string, unknown>) {
  return kpiHubFetch<Record<string, unknown>>(token, `${BASE}/formula/preview`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchNotifications(token: string) {
  return kpiHubFetch<{ data: unknown[] }>(token, `${BASE}/notifications`);
}

export type HubApprovalGroup = {
  id: string;
  label: string;
  count: number;
  items: Array<{
    id: string;
    kind: string;
    label: string;
    status: string;
    href?: string;
    policy?: Array<{ role: string; label: string }>;
  }>;
};

export async function fetchKpiHubApprovals(token: string) {
  return kpiHubFetch<{ groups: HubApprovalGroup[]; total: number }>(token, `${BASE}/approvals`);
}

export async function approveKpiHubItem(
  token: string,
  kind: string,
  id: string,
  note?: string,
) {
  return kpiHubFetch<Record<string, unknown>>(
    token,
    `${BASE}/approvals/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/approve`,
    { method: 'POST', body: JSON.stringify({ note }) },
  );
}

export async function rejectKpiHubItem(token: string, kind: string, id: string, note?: string) {
  return kpiHubFetch<Record<string, unknown>>(
    token,
    `${BASE}/approvals/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/reject`,
    { method: 'POST', body: JSON.stringify({ note }) },
  );
}

export type KpiLineageResponse = {
  code: string;
  dictionary: Record<string, unknown> | null;
  nodes: Array<{ id: string; label: string; kind: string; meta?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string }>;
  last_fact_at: string | null;
};

export async function fetchKpiHubLineage(token: string, code: string) {
  return kpiHubFetch<KpiLineageResponse>(
    token,
    `${BASE}/lineage?code=${encodeURIComponent(code)}`,
  );
}
