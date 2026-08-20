import { API_BASE, ApiError, parseJson } from './api';

export type VdProjectRow = {
  id: number;
  lifecycle_id: number;
  client_id: string | null;
  cmkt_item_id: number | null;
  title: string;
  stage: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateVdProjectBody = {
  lifecycle_id: number;
  cmkt_item_id: number;
  title?: string;
};

export function vdProjectCreatePath(): string {
  return '/api/v1/vd/projects';
}

export function vdProjectGetPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}`;
}

export function vdProjectListPath(lifecycleId: number | string): string {
  return `/api/v1/vd/projects?lifecycle_id=${encodeURIComponent(String(lifecycleId))}`;
}

export function vdAdminProvidersPath(): string {
  return '/api/v1/vd/admin/providers';
}

export function vdAdminModelsPath(): string {
  return '/api/v1/vd/admin/models';
}

export type VdProviderRow = {
  id: number;
  code: string;
  label: string;
  created_at?: string;
};

export type VdModelRow = {
  id: number;
  provider: string;
  code: string;
  capability_json: Record<string, unknown> | string;
  created_at?: string;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function vdFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(body.error ?? body.message ?? 'Video SOP request failed', res.status);
  }
  return body;
}

export async function createVdProject(token: string, body: CreateVdProjectBody): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectCreatePath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdProjects(token: string, lifecycleId: number): Promise<VdProjectRow[]> {
  const body = await vdFetch<VdProjectRow[] | { items?: VdProjectRow[] }>(
    token,
    vdProjectListPath(lifecycleId),
  );
  if (Array.isArray(body)) return body;
  return Array.isArray(body.items) ? body.items : [];
}

export async function getVdProject(token: string, id: number | string): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectGetPath(id));
}

function asItems<T>(body: T[] | { items?: T[] }): T[] {
  if (Array.isArray(body)) return body;
  return Array.isArray(body.items) ? body.items : [];
}

export async function listVdAdminProviders(token: string): Promise<VdProviderRow[]> {
  const body = await vdFetch<VdProviderRow[] | { items?: VdProviderRow[] }>(
    token,
    vdAdminProvidersPath(),
  );
  return asItems(body);
}

export async function createVdAdminProvider(
  token: string,
  body: { code: string; label: string },
): Promise<VdProviderRow> {
  return vdFetch<VdProviderRow>(token, vdAdminProvidersPath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdAdminModels(token: string): Promise<VdModelRow[]> {
  const body = await vdFetch<VdModelRow[] | { items?: VdModelRow[] }>(token, vdAdminModelsPath());
  return asItems(body);
}

export async function createVdAdminModel(
  token: string,
  body: { provider_code: string; code: string; capability_json: Record<string, unknown> | string },
): Promise<VdModelRow> {
  return vdFetch<VdModelRow>(token, vdAdminModelsPath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const VIDEO_SOP_API = {
  createProject: createVdProject,
  listProjects: listVdProjects,
  getProject: getVdProject,
  listAdminProviders: listVdAdminProviders,
  createAdminProvider: createVdAdminProvider,
  listAdminModels: listVdAdminModels,
  createAdminModel: createVdAdminModel,
};
