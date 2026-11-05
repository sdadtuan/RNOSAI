import type { APIRequestContext } from '@playwright/test';
import {
  API_URL,
  createCpProjectApi,
  fetchCpKpisApi,
  renderCpVideoApi,
  staffToken,
  UNKNOWN_CLIENT,
  type CpApiResult,
} from './cp-w1-helpers';
import {
  cpError,
  createCpVideoApi,
  getCpVideoVersionApi,
  listCpPublishVersionsApi,
  requireCpProject,
  requireCpVersion,
  type CpVideoVersionDto,
} from './cp-w2-helpers';
import { getCpReportApi } from './cp-w3-helpers';

export {
  API_URL,
  cpError,
  createCpProjectApi,
  createCpVideoApi,
  fetchCpKpisApi,
  getCpReportApi,
  getCpVideoVersionApi,
  listCpPublishVersionsApi,
  renderCpVideoApi,
  requireCpProject,
  requireCpVersion,
  staffToken,
  UNKNOWN_CLIENT,
};
export type { CpApiResult, CpVideoVersionDto };

export const FORECAST_ASSUMPTION =
  'Forecast = scheduled_batch_credits + historical_avg + reserved. Không gồm ads spend.';

export const FALLBACK_MODEL_ID = 'stub-lite';

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function result<T>(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
): Promise<CpApiResult<T>> {
  let json = {} as T;
  try {
    json = (await response.json()) as T;
  } catch {
    /* Preserve status for non-JSON failures. */
  }
  return { ok: response.ok(), status: response.status(), json };
}

export function snapshotLanguage(
  snapshot: Record<string, unknown> | null | undefined,
): string | null {
  if (!snapshot) return null;
  if (typeof snapshot.language === 'string') return snapshot.language;
  const draft = snapshot.draft && typeof snapshot.draft === 'object' && !Array.isArray(snapshot.draft)
    ? snapshot.draft as Record<string, unknown>
    : {};
  const draftConfig = draft.config_json && typeof draft.config_json === 'object' && !Array.isArray(draft.config_json)
    ? draft.config_json as Record<string, unknown>
    : {};
  if (typeof draftConfig.language === 'string') return draftConfig.language;
  const top = snapshot.config_json && typeof snapshot.config_json === 'object' && !Array.isArray(snapshot.config_json)
    ? snapshot.config_json as Record<string, unknown>
    : {};
  return typeof top.language === 'string' ? top.language : null;
}

export function isFallbackChildKey(key: unknown): boolean {
  return /:f\d+$/.test(String(key ?? ''));
}

export function stableSnapshot(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export async function getCpSettingsApi(
  request: APIRequestContext,
  token: string,
): Promise<CpApiResult<{
  routing_json?: { fallback_id?: string | null } & Record<string, unknown>;
} & Record<string, unknown>>> {
  return result(await request.get(`${API_URL}/api/crm/cp/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
}

export async function patchCpSettingsApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{
  routing_json?: { fallback_id?: string | null } & Record<string, unknown>;
} & Record<string, unknown>>> {
  return result(await request.patch(`${API_URL}/api/crm/cp/settings`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function requireFallbackRouting(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const patched = await patchCpSettingsApi(request, token, {
    routing_json: { fallback_id: FALLBACK_MODEL_ID },
  });
  if (patched.status === 403) {
    throw new Error(
      `Wave 4 prerequisite missing: staff lacks crm_cp.manage (${patched.status} ${JSON.stringify(patched.json)})`,
    );
  }
  if (!patched.ok) {
    throw new Error(
      `Wave 4 prerequisite missing: cannot persist routing_json.fallback_id (${patched.status} ${JSON.stringify(patched.json)})`,
    );
  }
  const stored = patched.json.routing_json?.fallback_id
    ?? (await getCpSettingsApi(request, token)).json.routing_json?.fallback_id;
  if (stored !== FALLBACK_MODEL_ID) {
    throw new Error(
      `Wave 4 prerequisite missing: routing_json.fallback_id is ${JSON.stringify(stored)}`,
    );
  }
}

export async function getCpVideoApi(
  request: APIRequestContext,
  token: string,
  videoId: string,
): Promise<CpApiResult<{
  id?: string;
  project_id?: string;
  config_json?: Record<string, unknown> | null;
  has_completed_version?: boolean;
} & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/videos/${encodeURIComponent(videoId)}?scope=all`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function patchCpVideoApi(
  request: APIRequestContext,
  token: string,
  videoId: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{
  id?: string;
  config_json?: Record<string, unknown> | null;
  has_completed_version?: boolean;
} & Record<string, unknown>>> {
  return result(await request.patch(
    `${API_URL}/api/crm/cp/videos/${encodeURIComponent(videoId)}?scope=all`,
    { headers: authHeaders(token), data: body },
  ));
}

export async function createCpExperimentApi(
  request: APIRequestContext,
  token: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{
  id?: string;
  project_id?: string;
  variants_json?: unknown;
} & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/projects/${encodeURIComponent(projectId)}/experiments?scope=all`,
    { headers: authHeaders(token), data: body },
  ));
}

export async function createCpExperimentVariantApi(
  request: APIRequestContext,
  token: string,
  experimentId: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{
  experiment?: { id?: string; variants_json?: unknown } & Record<string, unknown>;
  version?: CpVideoVersionDto & Record<string, unknown>;
} & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/experiments/${encodeURIComponent(experimentId)}/variants?scope=all`,
    { headers: authHeaders(token), data: body },
  ));
}

export async function listCpRendersApi(
  request: APIRequestContext,
  token: string,
): Promise<CpApiResult<{
  items?: Array<{
    id?: string;
    parent_job_id?: string | null;
    idempotency_key?: string;
    state?: string;
    draft_id?: string;
  } & Record<string, unknown>>;
}>> {
  return result(await request.get(`${API_URL}/api/crm/cp/renders?scope=all`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
}

export async function getCpRenderApi(
  request: APIRequestContext,
  token: string,
  jobId: string,
): Promise<CpApiResult<{
  id?: string;
  parent_job_id?: string | null;
  idempotency_key?: string;
  state?: string;
} & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/renders/${encodeURIComponent(jobId)}?scope=all`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function retryCpRenderApi(
  request: APIRequestContext,
  token: string,
  jobId: string,
): Promise<CpApiResult<{
  id?: string;
  parent_job_id?: string | null;
  idempotency_key?: string;
} & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/renders/${encodeURIComponent(jobId)}/retry?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function requireCompletedVersion(
  request: APIRequestContext,
  token: string,
): Promise<{ projectId: string; draftId: string; version: CpVideoVersionDto }> {
  try {
    const version = await requireCpVersion(request, token);
    if (version.id && version.draft_id) {
      let projectId = String(version.project_id ?? '');
      if (!projectId) {
        const draft = await getCpVideoApi(request, token, String(version.draft_id));
        projectId = String(draft.json.project_id ?? '');
      }
      if (!projectId) {
        throw new Error(
          `Wave 4 prerequisite missing: version ${version.id} has no project_id`,
        );
      }
      return {
        projectId,
        draftId: String(version.draft_id),
        version,
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Wave 4 prerequisite missing: version')) {
      throw error;
    }
    /* Create a fresh completed snapshot when the book has none. */
  }

  const project = await requireCpProject(request, token);
  const created = await createCpVideoApi(request, token, {
    project_id: project.id,
    name: `CP-W4-UAT-${Date.now()}`,
    input_mode: 'prompt',
    prompt: 'Wave 4 completed-version UAT',
    config_json: { language: 'vi', estimated_credits: 1 },
  });
  if (!created.ok || !created.json.id) {
    throw new Error(
      `Wave 4 prerequisite missing: cannot create a video draft (${created.status} ${JSON.stringify(created.json)})`,
    );
  }
  const rendered = await renderCpVideoApi(
    request,
    token,
    String(created.json.id),
    `cp-w4-complete-${crypto.randomUUID()}`,
  );
  if (rendered.status === 403) {
    throw new Error(
      `Wave 4 prerequisite missing: staff lacks crm_cp.render (${rendered.status} ${JSON.stringify(rendered.json)})`,
    );
  }
  if (!rendered.ok) {
    throw new Error(
      `Wave 4 prerequisite missing: draft ${created.json.id} cannot render (${rendered.status} ${JSON.stringify(rendered.json)})`,
    );
  }

  const version = await findCompletedVersionForDraft(
    request,
    token,
    String(created.json.id),
  );
  if (!version?.id) {
    throw new Error('Wave 4 prerequisite missing: render did not produce a video version');
  }
  return {
    projectId: project.id,
    draftId: String(created.json.id),
    version,
  };
}

export async function findCompletedVersionForDraft(
  request: APIRequestContext,
  token: string,
  draftId: string,
): Promise<CpVideoVersionDto | null> {
  const versions = await listCpPublishVersionsApi(request, token);
  for (const row of versions) {
    if (!row?.id) continue;
    const detail = await getCpVideoVersionApi(request, token, row.id);
    if (!detail.ok) continue;
    if (String(detail.json.draft_id ?? '') !== String(draftId)) continue;
    return {
      ...row,
      ...detail.json,
      id: row.id,
      draft_id: String(draftId),
    };
  }
  return null;
}

export function findFallbackChild(
  items: Array<Record<string, unknown>> | undefined,
  parentId: string,
  submitKey: string,
): Record<string, unknown> | undefined {
  if (!parentId || !submitKey) return undefined;
  const prefix = `${submitKey}:f`;
  return (items ?? []).find((row) => {
    const parent = row.parent_job_id == null ? '' : String(row.parent_job_id);
    return parent === parentId && String(row.idempotency_key ?? '').startsWith(prefix);
  });
}
