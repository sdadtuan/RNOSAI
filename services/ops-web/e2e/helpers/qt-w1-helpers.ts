import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';

export { API_URL, staffToken };

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
