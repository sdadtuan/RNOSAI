import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';

export { API_URL, staffToken };

export const UNKNOWN_CLIENT = '19d722af-0000-4000-8000-000000000099';

export const CP_KPI_KEYS = [
  'videos_created',
  'videos_approved',
  'render_success_rate',
  'render_avg_duration_sec',
  'credits_used',
  'credits_remaining',
  'assets_expiring',
  'tasks_overdue',
] as const;

export type CpKpiKey = (typeof CP_KPI_KEYS)[number];
export type CpKpisDto = Record<CpKpiKey, number | null>;

export type CpOverviewKpisDto = {
  last_updated: string;
  kpis: CpKpisDto;
};

export type CpVideoDraftDto = {
  id: string;
  config_json?: Record<string, unknown> | null;
};

export type CpRenderDto = {
  id?: string;
  job_id?: string;
  estimate?: number | null;
};

export type CpApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  json: T;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function result<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<CpApiResult<T>> {
  let json = {} as T;
  try {
    json = (await response.json()) as T;
  } catch {
    /* Preserve status for non-JSON failures. */
  }
  return { ok: response.ok(), status: response.status(), json };
}

export async function fetchCpKpisApi(
  request: APIRequestContext,
  token: string,
  query = '',
): Promise<CpOverviewKpisDto> {
  const suffix = query ? `?${query}` : '';
  const response = await request.get(`${API_URL}/api/crm/cp/overview/kpis${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `CP KPIs: ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as CpOverviewKpisDto;
}

export async function createCpProjectApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult> {
  return result(await request.post(`${API_URL}/api/crm/cp/projects`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function createCpAssetApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult> {
  return result(await request.post(`${API_URL}/api/crm/cp/assets`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function listCpVideosApi(
  request: APIRequestContext,
  token: string,
): Promise<CpVideoDraftDto[]> {
  const response = await request.get(`${API_URL}/api/crm/cp/videos?scope=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `CP videos: ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = (await response.json()) as { items?: CpVideoDraftDto[] };
  return body.items ?? [];
}

export async function renderCpVideoApi(
  request: APIRequestContext,
  token: string,
  videoId: string,
  idempotencyKey: string,
): Promise<CpApiResult<CpRenderDto & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/videos/${encodeURIComponent(videoId)}/render?scope=all`,
    {
      headers: {
        ...authHeaders(token),
        'Idempotency-Key': idempotencyKey,
      },
    },
  ));
}
