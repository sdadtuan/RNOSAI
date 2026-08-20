import { API_BASE, ApiError, parseJson } from './api';
import { hasCap, type StoredStaffUser } from './auth';

/** Same cap as API POST `/vd/projects/:id/jobs` (create or content write). */
export function canEnqueueVdJob(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'create') || hasCap(user, 'crm_content', 'write');
}

/** Same cap as API PUT/POST brief (project edit or content write). */
export function canEditVdBrief(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'edit') || hasCap(user, 'crm_content', 'write');
}

/** Same cap as API ideas/script/shots (script edit or project edit or content write). */
export function canEditVdScript(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.script', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

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

export function vdProjectJobsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/jobs`;
}

export function vdProjectBriefPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief`;
}

export function vdProjectBriefReadyPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief/ready`;
}

export function vdProjectBriefInsightsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief/insights`;
}

export function vdProjectIdeasPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/ideas`;
}

export function vdProjectIdeasGeneratePath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/ideas/generate`;
}

export function vdProjectIdeaSelectPath(projectId: number | string, ideaId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/ideas/${encodeURIComponent(String(ideaId))}/select`;
}

export function vdProjectScriptsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/scripts`;
}

export function vdScriptShotsPath(id: number | string): string {
  return `/api/v1/vd/scripts/${encodeURIComponent(String(id))}/shots`;
}

export function vdPromptTemplatesPath(): string {
  return '/api/v1/vd/prompt-templates';
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

export type VdJobRow = {
  id: number;
  project_id: number;
  shot_id: number | null;
  queue: string;
  job_type: string;
  status: string;
  error_class: string | null;
  attempt: number;
  idempotency_key?: string;
  input_json?: Record<string, unknown>;
  output_json?: Record<string, unknown>;
  created_at?: string;
  updated_at: string;
};

export type EnqueueVdJobBody = {
  queue: string;
  job_type: string;
  payload?: Record<string, unknown>;
};

export type EnqueueVdJobResult = {
  id: number;
  status: string;
};

export type VdBriefRow = {
  project_id: number;
  body_json: Record<string, unknown>;
  stage: string;
};

export type VdBriefInsight = {
  id: number;
  title: string;
};

export type VdIdeaRow = {
  id: number;
  project_id: number;
  ordinal: number;
  summary: string;
  selected: boolean;
};

export type VdScriptRow = {
  id: number;
  project_id: number;
  version: number;
  markdown: string;
};

export type VdShotRow = {
  id: number;
  script_id: number;
  ordinal: number;
  status: string;
  duration_ms: number;
  camera: string;
  action: string;
  aspect: string;
  contains_human?: boolean;
  text_in_frame?: boolean;
  logo_in_ai_frame?: boolean;
  seed?: number | null;
  feasibility?: Array<{ id: string; ok: boolean }> | string | null;
};

export type VdPromptTemplateRow = {
  code: string;
  kind: string;
  body: string;
};

export type AddVdShotBody = {
  duration_ms: number;
  camera: string;
  action: string;
  aspect?: string;
  contains_human?: boolean;
  text_in_frame?: boolean;
  logo_in_ai_frame?: boolean;
  seed?: number | null;
};

/** SC-04 form defaults: send explicit booleans so FR-R03 does not fail. */
export function sc04AddShotPayload(input: {
  duration_ms: number;
  camera: string;
  action: string;
  aspect?: string;
}): AddVdShotBody {
  return {
    duration_ms: input.duration_ms,
    camera: input.camera,
    action: input.action,
    aspect: input.aspect,
    contains_human: false,
    text_in_frame: false,
    logo_in_ai_frame: false,
  };
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

export async function listVdJobs(token: string, projectId: number | string): Promise<VdJobRow[]> {
  const body = await vdFetch<VdJobRow[] | { items?: VdJobRow[] }>(
    token,
    vdProjectJobsPath(projectId),
  );
  return asItems(body);
}

export async function getVdBrief(token: string, id: number | string): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefPath(id));
}

export async function saveVdBrief(
  token: string,
  id: number | string,
  body: Record<string, unknown>,
): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefPath(id), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function markVdBriefReady(token: string, id: number | string): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefReadyPath(id), { method: 'POST' });
}

export async function listVdBriefInsights(
  token: string,
  id: number | string,
): Promise<VdBriefInsight[]> {
  const body = await vdFetch<VdBriefInsight[] | { items?: VdBriefInsight[] }>(
    token,
    vdProjectBriefInsightsPath(id),
  );
  return asItems(body);
}

export async function listVdIdeas(token: string, projectId: number | string): Promise<VdIdeaRow[]> {
  const body = await vdFetch<VdIdeaRow[] | { items?: VdIdeaRow[] }>(
    token,
    vdProjectIdeasPath(projectId),
  );
  return asItems(body);
}

export async function generateVdIdeas(
  token: string,
  projectId: number | string,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdProjectIdeasGeneratePath(projectId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}

export async function selectVdIdea(
  token: string,
  projectId: number | string,
  ideaId: number | string,
): Promise<VdIdeaRow[]> {
  const body = await vdFetch<VdIdeaRow[] | { items?: VdIdeaRow[] }>(
    token,
    vdProjectIdeaSelectPath(projectId, ideaId),
    { method: 'POST' },
  );
  return asItems(body);
}

export async function listVdScripts(token: string, projectId: number | string): Promise<VdScriptRow[]> {
  const body = await vdFetch<VdScriptRow[] | { items?: VdScriptRow[] }>(
    token,
    vdProjectScriptsPath(projectId),
  );
  return asItems(body);
}

export async function saveVdScript(
  token: string,
  projectId: number | string,
  markdown: string,
): Promise<VdScriptRow> {
  return vdFetch<VdScriptRow>(token, vdProjectScriptsPath(projectId), {
    method: 'POST',
    body: JSON.stringify({ markdown }),
  });
}

export async function listVdShots(token: string, scriptId: number | string): Promise<VdShotRow[]> {
  const body = await vdFetch<VdShotRow[] | { items?: VdShotRow[] }>(token, vdScriptShotsPath(scriptId));
  return asItems(body);
}

export async function addVdShot(
  token: string,
  scriptId: number | string,
  body: AddVdShotBody,
): Promise<VdShotRow> {
  return vdFetch<VdShotRow>(token, vdScriptShotsPath(scriptId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdPromptTemplates(token: string): Promise<VdPromptTemplateRow[]> {
  const body = await vdFetch<VdPromptTemplateRow[] | { items?: VdPromptTemplateRow[] }>(
    token,
    vdPromptTemplatesPath(),
  );
  return asItems(body);
}

export async function enqueueVdJob(
  token: string,
  projectId: number | string,
  body: EnqueueVdJobBody,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdProjectJobsPath(projectId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
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
  getBrief: getVdBrief,
  saveBrief: saveVdBrief,
  markBriefReady: markVdBriefReady,
  listBriefInsights: listVdBriefInsights,
  listIdeas: listVdIdeas,
  generateIdeas: generateVdIdeas,
  selectIdea: selectVdIdea,
  listScripts: listVdScripts,
  saveScript: saveVdScript,
  listShots: listVdShots,
  addShot: addVdShot,
  listPromptTemplates: listVdPromptTemplates,
  listJobs: listVdJobs,
  enqueueJob: enqueueVdJob,
  listAdminProviders: listVdAdminProviders,
  createAdminProvider: createVdAdminProvider,
  listAdminModels: listVdAdminModels,
  createAdminModel: createVdAdminModel,
};
