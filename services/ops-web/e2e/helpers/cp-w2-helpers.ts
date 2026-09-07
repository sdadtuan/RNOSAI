import { expect, type APIRequestContext } from '@playwright/test';
import {
  API_URL,
  createCpProjectApi,
  listCpVideosApi,
  staffToken,
  type CpApiResult,
} from './cp-w1-helpers';

export { API_URL, createCpProjectApi, listCpVideosApi, staffToken };
export type { CpApiResult };

export const CP_W2_NAV = [
  '/crm/creative-os',
  '/crm/creative-os/projects',
  '/crm/creative-os/video',
  '/crm/creative-os/media',
  '/crm/creative-os/brand-kits',
  '/crm/creative-os/calendar',
  '/crm/creative-os/reports',
  '/crm/creative-os/settings',
] as const;

export const HUB_UNAVAILABLE_ERRORS = [
  'creatives_tables_not_ready',
  'creatives_unavailable',
] as const;

export const BLOCKING_QC_FACTS = {
  has_audio: false,
} as const;

export const PASSING_QC_FACTS = {
  width: 1080,
  height: 1920,
  duration_sec: 30,
  has_audio: true,
  safe_area_ok: true,
  caption_overflow: false,
  logo_present: true,
  cta_present: true,
  disclaimer_present: true,
  loudness_lufs: -14,
  black_frozen: false,
  moderation: 'ok',
} as const;

export const LOCKED_OVERLAY = 'W2-LOCKED-OVERLAY-KEEP';

export type CpProjectDto = {
  id: string;
  name?: string;
  agency_client_id?: string;
};

export type CpVideoDto = {
  id: string;
  project_id?: string;
  name?: string;
};

export type CpVideoVersionDto = {
  id: string;
  draft_id?: string;
  project_id?: string | null;
  approval_status?: string | null;
  qc_status?: string | null;
  snapshot_json?: Record<string, unknown> | null;
  output_uri?: string | null;
};

export type CpSceneDto = {
  idx?: number;
  overlay?: string | null;
  locked?: boolean | string | null;
  visual?: string | null;
  vo?: string | null;
};

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

export function cpError(json: Record<string, unknown>): string | undefined {
  if (typeof json.error === 'string' && !/^(Conflict|Not Found|Bad Request|Forbidden)$/i.test(json.error)) {
    return json.error;
  }
  const message = json.message;
  if (message && typeof message === 'object' && typeof (message as { error?: unknown }).error === 'string') {
    return (message as { error: string }).error;
  }
  if (typeof message === 'string') return message;
  return typeof json.error === 'string' ? json.error : undefined;
}

export function isHubUnavailable(status: number, json: Record<string, unknown>): boolean {
  const error = cpError(json);
  return (
    status === 503
    || (status === 500 && error === 'creatives_unavailable')
    || (error != null && (HUB_UNAVAILABLE_ERRORS as readonly string[]).includes(error))
  );
}

export function expiredRightsDate(): string {
  return new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function extractUsedAssetIds(version: CpVideoVersionDto): string[] {
  const snapshot = version.snapshot_json && typeof version.snapshot_json === 'object'
    ? version.snapshot_json
    : {};
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = String(value ?? '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      ids.add(id);
    }
  };
  if (Array.isArray(snapshot.asset_ids)) {
    for (const item of snapshot.asset_ids) {
      if (typeof item === 'string') add(item);
      else if (item && typeof item === 'object') {
        add((item as { asset_id?: unknown; id?: unknown }).asset_id
          ?? (item as { id?: unknown }).id);
      }
    }
  }
  add(snapshot.asset_id);
  return [...ids];
}

export async function listCpProjectsApi(
  request: APIRequestContext,
  token: string,
): Promise<CpProjectDto[]> {
  const response = await request.get(`${API_URL}/api/crm/cp/projects?scope=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `CP projects: ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = (await response.json()) as { items?: CpProjectDto[] };
  return body.items ?? [];
}

export async function listCpPublishVersionsApi(
  request: APIRequestContext,
  token: string,
): Promise<CpVideoVersionDto[]> {
  const response = await request.get(`${API_URL}/api/crm/cp/publish/versions?scope=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(
    response.ok(),
    `CP publish versions: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  const body = (await response.json()) as { items?: CpVideoVersionDto[] };
  return body.items ?? [];
}

export async function getCpVideoVersionApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<CpApiResult<CpVideoVersionDto & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/videos/versions/${encodeURIComponent(versionId)}?scope=all`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function requireCpVersion(
  request: APIRequestContext,
  token: string,
): Promise<CpVideoVersionDto> {
  const versions = await listCpPublishVersionsApi(request, token);
  const version = versions[0];
  if (!version?.id) {
    throw new Error('Wave 2 prerequisite missing: no video versions are available');
  }
  const detail = await getCpVideoVersionApi(request, token, version.id);
  if (!detail.ok) {
    throw new Error(
      `Wave 2 prerequisite missing: version ${version.id} (${detail.status} ${JSON.stringify(detail.json)})`,
    );
  }
  return { ...version, ...detail.json, id: version.id };
}

export async function requireCpProject(
  request: APIRequestContext,
  token: string,
): Promise<CpProjectDto> {
  const projects = await listCpProjectsApi(request, token);
  const project = projects[0];
  if (!project?.id) {
    throw new Error('Wave 2 prerequisite missing: no CP project with a real client is available');
  }
  return project;
}

export async function runCpQcApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  facts: Record<string, unknown>,
): Promise<CpApiResult> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/videos/versions/${encodeURIComponent(versionId)}/qc?scope=all`,
    { headers: authHeaders(token), data: facts },
  ));
}

export async function exportCpVideoVersionApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
): Promise<CpApiResult> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/videos/versions/${encodeURIComponent(versionId)}/export?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function submitCpCreativeApi(
  request: APIRequestContext,
  token: string,
  projectId: string,
  versionId: string,
): Promise<CpApiResult<{ creative_id?: string } & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/projects/${encodeURIComponent(projectId)}/submit-creative?scope=all`,
    { headers: authHeaders(token), data: { version_id: versionId } },
  ));
}

export async function submitCpApprovalApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  status: string,
): Promise<CpApiResult> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/videos/versions/${encodeURIComponent(versionId)}/approvals?scope=all`,
    { headers: authHeaders(token), data: { status } },
  ));
}

export async function scheduleCpPublishApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult> {
  return result(await request.post(`${API_URL}/api/crm/cp/publish?scope=all`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function createCpVideoApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<CpVideoDto & Record<string, unknown>>> {
  return result(await request.post(`${API_URL}/api/crm/cp/videos?scope=all`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function putCpScenesApi(
  request: APIRequestContext,
  token: string,
  videoId: string,
  scenes: Array<Record<string, unknown>>,
): Promise<CpApiResult<{ items?: CpSceneDto[] } & Record<string, unknown>>> {
  return result(await request.put(
    `${API_URL}/api/crm/cp/videos/${encodeURIComponent(videoId)}/scenes?scope=all`,
    { headers: authHeaders(token), data: { scenes } },
  ));
}

export async function regenerateCpSceneApi(
  request: APIRequestContext,
  token: string,
  videoId: string,
  idx: number,
): Promise<CpApiResult<CpSceneDto & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/videos/${encodeURIComponent(videoId)}/scenes/${encodeURIComponent(String(idx))}/regenerate?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function setCpAssetRightsApi(
  request: APIRequestContext,
  token: string,
  assetId: string,
  body: Record<string, unknown>,
): Promise<CpApiResult> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/assets/${encodeURIComponent(assetId)}/rights`,
    { headers: authHeaders(token), data: body },
  ));
}
