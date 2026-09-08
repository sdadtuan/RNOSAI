import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, LEAD_ID_ENV, staffToken } from './ai-copilot-helpers';

export { API_URL, staffToken };

export const QT_KPI_KEYS = [
  'open_quote_value',
  'pending_approval_count',
  'quote_win_rate',
  'forecast_gross_margin',
] as const;

export const QT_WIN_RATE_FORMULA = 'accepted/(accepted+rejected)' as const;
export const QT_PUBLIC_ACCEPT_CTA = 'Xác nhận đề xuất';
export const QT_MOCK_MONEY = '265647600';
export const QT_LEAD_ID_ENV = process.env.OPS_E2E_QT_LEAD_ID ?? LEAD_ID_ENV;

export type QtCreateFromLeadBody = {
  lead_id: number;
  title: string;
  quote_type?: string;
  agency_client_id?: string;
  customer_id?: number;
  idempotencyKey?: string;
};

export type QtCreateResult = {
  proposal?: {
    id: number;
    quote_code: string;
    status: string;
    current_version_id: string;
  };
};

export type QtApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  json: T;
};

const authHeaders = (token: string, idempotencyKey: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Idempotency-Key': idempotencyKey,
});

export async function createQuoteFromLeadApi(
  request: APIRequestContext,
  token: string,
  body: QtCreateFromLeadBody,
): Promise<QtApiResult<QtCreateResult>> {
  const idempotencyKey = body.idempotencyKey || `qt-lead-${body.lead_id}-${Date.now()}`;
  const payload: Record<string, unknown> = {
    source: 'lead',
    lead_id: body.lead_id,
    title: body.title,
    quote_type: body.quote_type ?? 'new_business',
  };
  if (body.agency_client_id) payload.agency_client_id = body.agency_client_id;
  if (body.customer_id) payload.customer_id = body.customer_id;

  const response = await request.post(`${API_URL}/api/crm/proposals`, {
    headers: authHeaders(token, idempotencyKey),
    data: payload,
  });
  let json = {} as QtCreateResult;
  try {
    json = (await response.json()) as QtCreateResult;
  } catch {
    /* Preserve status for non-JSON failures. */
  }
  return { ok: response.ok(), status: response.status(), json };
}

export async function createQuoteFromLeadOrThrow(
  request: APIRequestContext,
  token: string,
  body: QtCreateFromLeadBody,
): Promise<QtCreateResult> {
  const result = await createQuoteFromLeadApi(request, token, body);
  expect(result.ok, `QT create from lead: ${result.status}`).toBeTruthy();
  return result.json;
}

async function parseJson<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function qtApi<T = Record<string, unknown>>(
  request: APIRequestContext,
  token: string,
  path: string,
  init?: { method?: string; data?: unknown; idempotencyKey?: string },
): Promise<QtApiResult<T>> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (init?.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await request.fetch(url, {
    method,
    headers,
    data: init?.data,
  });
  return {
    ok: response.ok(),
    status: response.status(),
    json: await parseJson<T>(response),
  };
}

export type QtOverviewDto = {
  last_updated?: string;
  kpis?: Record<string, number | null>;
  win_rate_formula?: string;
};

export async function fetchQtOverviewApi(
  request: APIRequestContext,
  token: string,
): Promise<QtApiResult<QtOverviewDto>> {
  return qtApi<QtOverviewDto>(request, token, '/api/crm/proposals/overview?scope=all');
}

export async function putQtLinesApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  lines: Array<Record<string, unknown>>,
): Promise<QtApiResult> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/lines`, {
    method: 'PUT',
    data: { lines },
  });
}

export async function putQtPaymentsApi(
  request: APIRequestContext,
  token: string,
  versionId: string,
  items: Array<{ pct_bps: number; milestone?: string }>,
): Promise<QtApiResult<{ items?: Array<{ pct_bps: number; amount_vnd?: number | string }> }>> {
  return qtApi(request, token, `/api/crm/quote-versions/${encodeURIComponent(versionId)}/payments`, {
    method: 'PUT',
    data: { items },
  });
}

export type QtConvertDto = {
  conversion_id?: string;
  lifecycles?: Array<{ line_id: number; lifecycle_id: number; dv_code: string }>;
  invoice_draft_ids?: number[];
};

export async function convertQtVersionApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
  versionId: string,
  idempotencyKey: string,
): Promise<QtApiResult<QtConvertDto>> {
  return qtApi<QtConvertDto>(
    request,
    token,
    `/api/crm/proposals/${proposalId}/versions/${encodeURIComponent(versionId)}/convert`,
    { method: 'POST', idempotencyKey },
  );
}

export async function mintQtShareApi(
  request: APIRequestContext,
  token: string,
  proposalId: number,
): Promise<QtApiResult<{ token?: string }>> {
  return qtApi(request, token, `/api/crm/proposals/${proposalId}/share`, { method: 'POST' });
}

export async function fetchPublicProposalApi(
  request: APIRequestContext,
  shareToken: string,
): Promise<QtApiResult<{ cta?: { accept?: string }; otp_required?: boolean; options?: unknown[] }>> {
  return qtApi(request, '', `/api/public/proposals/${encodeURIComponent(shareToken)}`);
}

export async function requestPublicProposalOtpApi(
  request: APIRequestContext,
  shareToken: string,
  email: string,
): Promise<QtApiResult<{ sent?: boolean }>> {
  return qtApi(request, '', `/api/public/proposals/${encodeURIComponent(shareToken)}/otp`, {
    method: 'POST',
    data: { email },
  });
}

export async function acceptPublicProposalApi(
  request: APIRequestContext,
  shareToken: string,
  body: {
    accepted: boolean;
    name: string;
    email: string;
    title?: string;
    option_key?: string;
    otp?: string;
  },
): Promise<QtApiResult<{ status?: string; option_key?: string }>> {
  return qtApi(request, '', `/api/public/proposals/${encodeURIComponent(shareToken)}/accept`, {
    method: 'POST',
    data: body,
  });
}

export function publicHtmlLeaks(html: string): string[] {
  const hits: string[] = [];
  if (/margin/i.test(html)) hits.push('margin');
  if (/\bNSR\b/.test(html)) hits.push('NSR');
  return hits;
}

export function renderPublicProposalFixtureHtml(overrides: Record<string, unknown> = {}): string {
  const title = String(overrides.title ?? 'Growth Proposal Q4/2026');
  const objective = String(overrides.objective ?? 'Lead căn hộ cao cấp');
  const optionB = String(overrides.option_b ?? 'B · Growth');
  const cta = String(overrides.cta ?? QT_PUBLIC_ACCEPT_CTA);
  const extra = String(overrides.extra ?? '');
  return [
    '<article class="deal-teaser-card qt-public">',
    `<h1>${title}</h1>`,
    `<p>${objective}</p>`,
    '<label>Phương án<select><option>A · Core</option>',
    `<option selected>${optionB}</option></select></label>`,
    '<label>Mã OTP<input name="otp" value="123456"/></label>',
    `<button type="submit">${cta}</button>`,
    extra,
    '</article>',
  ].join('');
}

export async function fetchQtCatalogApi(
  request: APIRequestContext,
  token: string,
): Promise<QtApiResult<{ services?: Array<Record<string, unknown>>; families?: Array<Record<string, unknown>> }>> {
  return qtApi(request, token, '/api/crm/proposals/quote-catalog');
}

export async function listQtQuotesApi(
  request: APIRequestContext,
  token: string,
  query = 'scope=all&page_size=50',
): Promise<QtApiResult<{ items?: Array<Record<string, unknown>>; proposals?: Array<Record<string, unknown>> }>> {
  return qtApi(request, token, `/api/crm/proposals?${query}`);
}

export async function getQtProposalApi(
  request: APIRequestContext,
  token: string,
  id: number,
): Promise<QtApiResult<{ id?: number; status?: string; current_version_id?: string; lead_id?: number }>> {
  return qtApi(request, token, `/api/crm/proposals/${id}`);
}

export async function patchQtStatusApi(
  request: APIRequestContext,
  token: string,
  id: number,
  status: string,
): Promise<QtApiResult> {
  return qtApi(request, token, `/api/crm/proposals/${id}/status`, {
    method: 'PATCH',
    data: { status },
  });
}

export async function resolveQtLeadId(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const fromEnv = Number(QT_LEAD_ID_ENV);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  const listed = await request.get(`${API_URL}/api/v1/leads?limit=5&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (listed.ok()) {
    const body = (await listed.json()) as { leads?: Array<{ id?: number }> };
    const id = Number(body.leads?.[0]?.id);
    if (Number.isInteger(id) && id > 0) return id;
  }
  throw new Error('Wave 1 prerequisite missing: set OPS_E2E_QT_LEAD_ID or OPS_E2E_AI_LEAD_ID');
}

export function qtCatalogItems(body: {
  services?: Array<Record<string, unknown>>;
  families?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  if (Array.isArray(body.services)) return body.services;
  if (Array.isArray(body.families)) return body.families;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

export function assertNoMockMoneyInQtComponents(): void {
  const root = join(__dirname, '../../src/components/crm/qt');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?|css)$/.test(name)) continue;
      const text = readFileSync(full, 'utf8');
      if (text.includes(QT_MOCK_MONEY)) hits.push(full);
    }
  };
  walk(root);
  expect(hits, `found ${QT_MOCK_MONEY} in ${hits.join(', ')}`).toEqual([]);
}
