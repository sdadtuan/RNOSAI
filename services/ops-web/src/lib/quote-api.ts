import { API_BASE, ApiError, parseJson } from './api';

export class QuoteApiError extends ApiError {
  constructor(message: string, status: number, readonly code?: string) {
    super(message, status);
    this.name = 'QuoteApiError';
  }
}

export type QuoteCatalogService = {
  dv_code: string;
  name: string;
  service_slug: string;
  readiness: string;
  depends_on_dv: string[];
};

export type QuoteLineItem = {
  id?: number;
  dv_code: string;
  package_tier: 'basic' | 'standard' | 'premium';
  service_slug?: string;
  reference_price_min?: number;
  reference_price_max?: number;
  final_price_vnd: number;
  scope_notes?: string;
  lifecycle_id?: number | null;
};

export type QuoteProposalDetail = {
  id: number;
  customer_id: number;
  total_vnd: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes: string;
  valid_until: string | null;
  price_adjustment_reason: string;
  lines?: QuoteLineItem[];
  line_count?: number;
};

async function quoteFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new QuoteApiError(body.message ?? body.error ?? 'Quote request failed', res.status, body.error);
  }
  return body;
}

export async function fetchQuoteCatalog(token: string, serviceSlug?: string) {
  const qs = serviceSlug ? `?service_slug=${encodeURIComponent(serviceSlug)}` : '';
  return quoteFetch<{
    services: QuoteCatalogService[];
    package_tiers: string[];
    primary_dv?: string | null;
    suggested_bundle?: string[];
  }>(token, `/api/crm/proposals/quote-catalog${qs}`);
}

export async function createQuoteProposal(
  token: string,
  body: {
    customer_id?: number;
    lead_id?: number;
    presales_id?: number;
    service_slug?: string;
    package_tier?: string;
    auto_lines?: boolean;
    lines?: Array<{ dv_code: string; package_tier: string; final_price_vnd?: number; scope_notes?: string }>;
    notes?: string;
    valid_until?: string | null;
  },
) {
  return quoteFetch<QuoteProposalDetail>(token, '/api/crm/proposals', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchQuoteProposal(token: string, id: number) {
  return quoteFetch<QuoteProposalDetail>(token, `/api/crm/proposals/${id}`);
}

export async function putQuoteLines(
  token: string,
  proposalId: number,
  body: { lines: QuoteLineItem[]; price_adjustment_reason?: string },
) {
  return quoteFetch<{ lines: QuoteLineItem[]; total_vnd: number }>(
    token,
    `/api/crm/proposals/${proposalId}/lines`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export async function patchQuoteStatus(
  token: string,
  proposalId: number,
  body: { status: string; price_adjustment_reason?: string; spawn_week?: boolean },
) {
  return quoteFetch(token, `/api/crm/proposals/${proposalId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function exportQuoteProposal(token: string, proposalId: number, format: 'pdf' | 'docx') {
  const res = await fetch(`${API_BASE}/api/crm/proposals/${proposalId}/export?format=${format}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new QuoteApiError(body.message ?? body.error ?? 'Export failed', res.status, body.error);
  }
  return res.blob();
}

export const QUOTE_TIER_LABEL: Record<string, string> = {
  basic: 'Cơ bản',
  standard: 'Tiêu chuẩn',
  premium: 'Chuyên sâu',
};
