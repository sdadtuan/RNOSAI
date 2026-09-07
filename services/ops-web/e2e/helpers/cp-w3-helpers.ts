import type { APIRequestContext } from '@playwright/test';
import {
  API_URL,
  createCpProjectApi,
  fetchCpKpisApi,
  staffToken,
  UNKNOWN_CLIENT,
  type CpApiResult,
} from './cp-w1-helpers';
import { requireCpProject, requireCpVersion, cpError } from './cp-w2-helpers';

export {
  API_URL,
  createCpProjectApi,
  fetchCpKpisApi,
  staffToken,
  UNKNOWN_CLIENT,
  requireCpProject,
  requireCpVersion,
  cpError,
};
export type { CpApiResult };

export const CP_W3_REPORT_TABS = [
  { slug: 'executive', href: '/crm/creative-os/reports', h1: 'Báo cáo điều hành' },
  { slug: 'production', href: '/crm/creative-os/reports?tab=production', h1: 'Phân tích sản xuất' },
  { slug: 'credit', href: '/crm/creative-os/reports?tab=credit', h1: 'Credit & ngân sách' },
  { slug: 'performance', href: '/crm/creative-os/reports?tab=performance', h1: 'Hiệu quả nội dung' },
  { slug: 'governance', href: '/crm/creative-os/reports?tab=governance', h1: 'Quản trị' },
] as const;

export const CP_W3_TEMPLATE_VARS = [
  'project_name',
  'price_from',
  'location',
  'cta',
  'hotline',
] as const;

export const FOREIGN_COLLECTION_ID = '19d722af-0000-4000-8000-000000000088';
export const FOREIGN_ASSET_ID = '19d722af-0000-4000-8000-000000000077';
export const INVALID_VERSION_ID = '19d722af-0000-4000-8000-000000000066';

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

export function identityMapping(): Record<string, string> {
  return Object.fromEntries(CP_W3_TEMPLATE_VARS.map((key) => [key, key]));
}

export function sampleBatchRow(
  n: number,
  missing?: (typeof CP_W3_TEMPLATE_VARS)[number],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    project_name: `Peak ${n}`,
    price_from: `Từ ${n} tỷ`,
    location: 'Q7',
    cta: 'Đăng ký tour',
    hotline: '1900',
  };
  if (missing) row[missing] = '';
  return row;
}

export async function createCpTemplateApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{ id?: string } & Record<string, unknown>>> {
  return result(await request.post(`${API_URL}/api/crm/cp/templates`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function publishCpTemplateApi(
  request: APIRequestContext,
  token: string,
  templateId: string,
): Promise<CpApiResult<{ id?: string } & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/templates/${encodeURIComponent(templateId)}/publish`,
    { headers: authHeaders(token) },
  ));
}

export async function requirePublishedTemplate(
  request: APIRequestContext,
  token: string,
): Promise<{ id: string }> {
  const created = await createCpTemplateApi(request, token, {
    name: `CP-W3-UAT-tpl-${Date.now()}`,
    variables: [...CP_W3_TEMPLATE_VARS],
    rules_json: { unit_credits: 1 },
  });
  if (!created.ok || !created.json.id) {
    throw new Error(
      `Wave 3 prerequisite missing: cannot create template (${created.status} ${JSON.stringify(created.json)})`,
    );
  }
  const published = await publishCpTemplateApi(request, token, String(created.json.id));
  if (!published.ok || !published.json.id) {
    throw new Error(
      `Wave 3 prerequisite missing: cannot publish template (${published.status} ${JSON.stringify(published.json)})`,
    );
  }
  return { id: String(published.json.id) };
}

export async function createCpBatchApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{ id?: string; items?: Array<Record<string, unknown>> } & Record<string, unknown>>> {
  return result(await request.post(`${API_URL}/api/crm/cp/batches?scope=all`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function validateCpBatchApi(
  request: APIRequestContext,
  token: string,
  batchId: string,
): Promise<CpApiResult<{
  id?: string;
  valid_count?: number;
  invalid_count?: number;
  items?: Array<Record<string, unknown>>;
} & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/batches/${encodeURIComponent(batchId)}/validate?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function runCpBatchApi(
  request: APIRequestContext,
  token: string,
  batchId: string,
): Promise<CpApiResult<{ items?: Array<Record<string, unknown>> } & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/batches/${encodeURIComponent(batchId)}/run?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function retryCpBatchItemApi(
  request: APIRequestContext,
  token: string,
  batchId: string,
  rowNo: number,
): Promise<CpApiResult<{ status?: string; job_id?: string } & Record<string, unknown>>> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(String(rowNo))}/retry?scope=all`,
    { headers: authHeaders(token) },
  ));
}

export async function getCpBatchApi(
  request: APIRequestContext,
  token: string,
  batchId: string,
): Promise<CpApiResult<{ items?: Array<Record<string, unknown>> } & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/batches/${encodeURIComponent(batchId)}?scope=all`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function getCpBatchErrorsCsv(
  request: APIRequestContext,
  token: string,
  batchId: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await request.get(
    `${API_URL}/api/crm/cp/batches/${encodeURIComponent(batchId)}/errors.csv?scope=all`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return { ok: response.ok(), status: response.status(), text: await response.text() };
}

export async function getCpReportApi(
  request: APIRequestContext,
  token: string,
  slug: string,
  query = 'scope=all',
): Promise<CpApiResult<{
  slug?: string;
  metrics?: Record<string, { value?: unknown; source?: unknown; freshness?: unknown }>;
  funnel?: unknown;
} & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/reports/${encodeURIComponent(slug)}?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function createCpCollectionApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{ id?: string; smart_filter_json?: unknown } & Record<string, unknown>>> {
  return result(await request.post(`${API_URL}/api/crm/cp/collections`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function getCpCollectionApi(
  request: APIRequestContext,
  token: string,
  collectionId: string,
  query = 'scope=me',
): Promise<CpApiResult<{ items?: Array<Record<string, unknown>> } & Record<string, unknown>>> {
  return result(await request.get(
    `${API_URL}/api/crm/cp/collections/${encodeURIComponent(collectionId)}?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ));
}

export async function addCpCollectionItemApi(
  request: APIRequestContext,
  token: string,
  collectionId: string,
  assetId: string,
  query = 'scope=me',
): Promise<CpApiResult> {
  return result(await request.post(
    `${API_URL}/api/crm/cp/collections/${encodeURIComponent(collectionId)}/items?${query}`,
    { headers: authHeaders(token), data: { asset_id: assetId } },
  ));
}

export async function bulkCpPublishApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
): Promise<CpApiResult<{
  items?: Array<Record<string, unknown>>;
  skipped?: Array<{ video_version_id?: string; reason?: string }>;
} & Record<string, unknown>>> {
  return result(await request.post(`${API_URL}/api/crm/cp/publish/bulk?scope=all`, {
    headers: authHeaders(token),
    data: body,
  }));
}

export async function requirePreparedBatch(
  request: APIRequestContext,
  token: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ id: string }> {
  const template = await requirePublishedTemplate(request, token);
  const project = await requireCpProject(request, token);
  const created = await createCpBatchApi(request, token, {
    template_id: template.id,
    project_id: project.id,
    rows,
    mapping: identityMapping(),
  });
  if (!created.ok || !created.json.id) {
    throw new Error(
      `Wave 3 prerequisite missing: cannot create batch (${created.status} ${JSON.stringify(created.json)})`,
    );
  }
  return { id: String(created.json.id) };
}
