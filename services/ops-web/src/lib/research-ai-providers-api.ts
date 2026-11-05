import { API_BASE, parseJson, ApiError } from './api';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(
      (typeof body.message === 'string' && body.message) || body.error || `HTTP ${res.status}`,
      res.status,
    );
  }
  return body;
}

export type ResearchAiProvider = {
  id: number;
  code: string;
  display_name: string;
  base_url: string;
  auth_type: 'bearer_api_key' | 'header_api_key';
  auth_header_name: string | null;
  enabled: boolean;
  sort_order: number;
  notes: string | null;
  model_count: number;
  has_enabled_credential: boolean;
};

export type ResearchAiModel = {
  id: number;
  provider_id: number;
  model_id: string;
  label: string;
  recommended_for: string | null;
  is_default: boolean;
  enabled: boolean;
  sort_order: number;
};

export type ResearchAiCredential = {
  id: number;
  provider_id: number;
  label: string;
  token_hint: string;
  is_primary: boolean;
  enabled: boolean;
};

export function fetchResearchAiProviders(token: string) {
  return fetchJson<{ providers: ResearchAiProvider[] }>(
    token,
    '/api/v1/research/admin/ai-providers',
  );
}

export function createResearchAiProvider(
  token: string,
  body: {
    code: string;
    display_name: string;
    base_url: string;
    auth_type?: string;
    enabled?: boolean;
  },
) {
  return fetchJson<ResearchAiProvider>(token, '/api/v1/research/admin/ai-providers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchResearchAiProvider(
  token: string,
  id: number,
  body: Partial<{ display_name: string; base_url: string; enabled: boolean; notes: string | null }>,
) {
  return fetchJson<ResearchAiProvider>(token, `/api/v1/research/admin/ai-providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteResearchAiProvider(token: string, id: number) {
  return fetchJson<{ ok: true }>(token, `/api/v1/research/admin/ai-providers/${id}`, {
    method: 'DELETE',
  });
}

export function fetchResearchAiModels(token: string, providerId: number) {
  return fetchJson<{ models: ResearchAiModel[] }>(
    token,
    `/api/v1/research/admin/ai-providers/${providerId}/models`,
  );
}

export function createResearchAiModel(
  token: string,
  providerId: number,
  body: {
    model_id: string;
    label: string;
    is_default?: boolean;
    recommended_for?: string;
    enabled?: boolean;
  },
) {
  return fetchJson<ResearchAiModel>(
    token,
    `/api/v1/research/admin/ai-providers/${providerId}/models`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function patchResearchAiModel(
  token: string,
  modelId: number,
  body: Partial<{
    label: string;
    is_default: boolean;
    enabled: boolean;
    recommended_for: string | null;
  }>,
) {
  return fetchJson<ResearchAiModel>(token, `/api/v1/research/admin/ai-models/${modelId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteResearchAiModel(token: string, modelId: number) {
  return fetchJson<{ ok: true }>(token, `/api/v1/research/admin/ai-models/${modelId}`, {
    method: 'DELETE',
  });
}

export function fetchResearchAiCredentials(token: string, providerId: number) {
  return fetchJson<{ credentials: ResearchAiCredential[] }>(
    token,
    `/api/v1/research/admin/ai-providers/${providerId}/credentials`,
  );
}

export function createResearchAiCredential(
  token: string,
  providerId: number,
  body: { label: string; api_token: string; is_primary?: boolean },
) {
  return fetchJson<ResearchAiCredential>(
    token,
    `/api/v1/research/admin/ai-providers/${providerId}/credentials`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function patchResearchAiCredential(
  token: string,
  credId: number,
  body: Partial<{ label: string; enabled: boolean; is_primary: boolean; api_token: string }>,
) {
  return fetchJson<ResearchAiCredential>(
    token,
    `/api/v1/research/admin/ai-credentials/${credId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function deleteResearchAiCredential(token: string, credId: number) {
  return fetchJson<{ ok: true }>(token, `/api/v1/research/admin/ai-credentials/${credId}`, {
    method: 'DELETE',
  });
}

export function testResearchAiProvider(token: string, providerId: number, modelId?: string) {
  return fetchJson<{ ok: boolean; latency_ms?: number; error?: string }>(
    token,
    `/api/v1/research/admin/ai-providers/${providerId}/test`,
    { method: 'POST', body: JSON.stringify({ model_id: modelId }) },
  );
}
