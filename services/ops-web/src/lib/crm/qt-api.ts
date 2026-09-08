import { API_BASE, ApiError, parseJson } from '@/lib/api';

export class QtApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
  ) {
    super(message, status);
    this.name = 'QtApiError';
  }
}

export const QT_WIN_RATE_FORMULA = 'accepted/(accepted+rejected)' as const;

export type QtKpiKey =
  | 'open_quote_value'
  | 'pending_approval_count'
  | 'quote_win_rate'
  | 'forecast_gross_margin';

export type QtOverviewKpis = Record<QtKpiKey, number | null>;

export type QtByStatusRow = {
  status: string;
  count: number;
  payable_vnd: number | null;
};

export type QtOverviewHealth = {
  below_floor: number;
  discount_over_cap: number;
  cost_missing: number;
  viewed_no_reply: number;
};

export type QtOverviewResponse = {
  last_updated: string;
  kpis: QtOverviewKpis;
  win_rate_formula: string;
  by_status: QtByStatusRow[];
  health: QtOverviewHealth;
};

export type QtActionRow = {
  severity: string;
  title: string;
  impact: string;
  owner_staff_id: number | null;
  sla: string | null;
  href: string;
  resource_type: string;
  resource_id: string;
};

export type QtActivityRow = {
  id: string;
  proposal_id: number;
  version_id: string | null;
  actor_staff_id: number | null;
  actor_kind: string;
  action: string;
  resource: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
};

export type QtOverviewQuery = {
  from?: string;
  to?: string;
  scope?: 'me' | 'team' | 'all';
  owner?: string;
  action?: string;
};

function querySuffix(path: string, query: QtOverviewQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.scope && query.scope !== 'me') params.set('scope', query.scope);
  if (query.owner) params.set('owner', query.owner);
  if (query.action) params.set('action', query.action);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function asQtActions(body: unknown): QtActionRow[] {
  if (Array.isArray(body)) return body as QtActionRow[];
  if (body && typeof body === 'object' && Array.isArray((body as { actions?: unknown }).actions)) {
    return (body as { actions: QtActionRow[] }).actions;
  }
  return [];
}

export function getQtOverview(token: string, query: QtOverviewQuery = {}) {
  return qtFetch<QtOverviewResponse>(token, querySuffix('/overview', query));
}

export function getQtActions(token: string, query: Pick<QtOverviewQuery, 'scope'> = {}) {
  return qtFetch<QtActionRow[] | { actions: QtActionRow[] }>(
    token,
    querySuffix('/actions', query),
  ).then(asQtActions);
}

export function getQtActivity(token: string, query: QtOverviewQuery = {}) {
  return qtFetch<{ items: QtActivityRow[] }>(token, querySuffix('/activity', query));
}

export type QtListQuery = {
  scope?: 'me' | 'team' | 'all';
  status?: string;
  q?: string;
  expiring?: boolean | string;
  pending_my_approval?: boolean | string;
  page?: number | string;
  page_size?: number | string;
  open?: boolean;
};

export type QtListItem = {
  id: number;
  quote_code: string | null;
  version_n: number | null;
  client_name: string | null;
  lead_code: string | null;
  option: null;
  payable_vnd: number | null;
  fee_vnd: number | null;
  gm_bps: number | null;
  status: string;
  valid_until: string | null;
  owner: { staff_id: number | null; name: string | null };
};

export type QtListResult = {
  items: QtListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type QtCreateSource = 'lead' | 'am360' | 'blank';

export type QtCreateBody = {
  source: QtCreateSource;
  lead_id?: number;
  agency_client_id?: string;
  customer_id?: number;
  title: string;
  quote_type: string;
};

export type QtCreateResult = {
  proposal: {
    id: number;
    quote_code: string;
    status: string;
    current_version_id: string;
  };
};

function truthyFlag(value: unknown): boolean {
  if (value === true) return true;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function buildQtListSearchParams(query: QtListQuery = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  if (truthyFlag(query.expiring)) params.set('expiring', '1');
  if (truthyFlag(query.pending_my_approval)) params.set('pending_my_approval', '1');
  if (query.page) params.set('page', String(query.page));
  if (query.page_size) params.set('page_size', String(query.page_size));
  if (truthyFlag(query.open)) params.set('open', '1');
  return params;
}

export function getQtQuotes(token: string, query: QtListQuery = {}) {
  const qs = buildQtListSearchParams(query).toString();
  return qtFetch<QtListResult>(token, qs ? `?${qs}` : '');
}

export function createQtQuote(token: string, body: QtCreateBody, idempotencyKey: string) {
  return qtFetch<QtCreateResult>(token, '', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

export function getQtActivityCsv(token: string, query: QtOverviewQuery = {}) {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.owner) params.set('owner', query.owner);
  if (query.action) params.set('action', query.action);
  params.set('export', 'csv');
  return qtFetch<{ csv: string; filename: string }>(token, `/activity?${params.toString()}`);
}

export type QtPackageTier = 'basic' | 'standard' | 'premium';

export type QtBuilderProposal = {
  id: number;
  quote_code?: string | null;
  current_version_id?: string | null;
  current_version_state?: string | null;
  row_version?: number;
  status: string;
  title?: string | null;
  objective?: string | null;
  audience?: string | null;
  campaign_period?: string | null;
  agency_client_id?: string | null;
  customer_id?: number | null;
  lead_id?: number | null;
  valid_until?: string | null;
  owner_staff_id?: number | null;
  created_at?: string | null;
  lines?: QtBuilderLine[];
};

export type QtBuilderLine = {
  id?: number;
  dv_code: string;
  sku_code?: string | null;
  package_tier?: string;
  service_slug?: string;
  item_type?: string;
  qty?: number;
  client_visible?: boolean;
  media_vnd?: number | null;
  media_amount_vnd?: number | null;
  final_price_vnd?: number | null;
  unit_price_vnd?: number | null;
  discount_vnd?: number | null;
  catalog_snapshot_json?: Record<string, unknown> | null;
  cost_labor_vnd?: number | null;
  cost_outsource_vnd?: number | null;
  cost_other_vnd?: number | null;
  name?: string | null;
};

export type QtRecalcResult = {
  fee_vnd?: number | null;
  media_vnd?: number | null;
  discount_vnd?: number | null;
  tax_vnd?: number | null;
  payable_vnd?: number | null;
  nsr_vnd?: number | null;
  gm_bps?: number | null;
  payments?: Array<{ pct_bps: number; amount_vnd: number; milestone: string }>;
};

export type QtCatalogItem = {
  dv_code: string;
  name?: string | null;
  name_vi?: string | null;
  status?: string;
  can_add_to_client_quote?: boolean;
  package_tiers?: Array<{
    tier: string;
    suggested_vnd?: number | null;
    rate_missing?: boolean;
  }>;
  catalog_snapshot_json?: Record<string, unknown>;
};

export type QtPaymentItem = {
  pct_bps: number;
  amount_vnd?: number | null;
  milestone?: string;
  seq?: number;
};

export function asQtCatalogItems(body: unknown): QtCatalogItem[] {
  if (Array.isArray(body)) return body as QtCatalogItem[];
  if (body && typeof body === 'object') {
    const rec = body as { services?: unknown; families?: unknown; items?: unknown };
    if (Array.isArray(rec.services)) return rec.services as QtCatalogItem[];
    if (Array.isArray(rec.families)) return rec.families as QtCatalogItem[];
    if (Array.isArray(rec.items)) return rec.items as QtCatalogItem[];
  }
  return [];
}

export function getQtProposal(token: string, id: number) {
  return qtFetch<QtBuilderProposal>(token, `/${id}`);
}

export function getQtProposalLines(token: string, id: number) {
  return qtFetch<{ proposal_id: number; lines: QtBuilderLine[] }>(token, `/${id}/lines`);
}

export function patchQtProposal(
  token: string,
  id: number,
  body: Record<string, unknown>,
  rowVersion: number,
) {
  return qtFetch<QtBuilderProposal>(token, `/${id}`, {
    method: 'PATCH',
    headers: { 'If-Match': String(rowVersion) },
    body: JSON.stringify(body),
  });
}

export function putQtLines(token: string, id: number, lines: QtBuilderLine[]) {
  return qtFetch<{ proposal_id: number; lines: QtBuilderLine[] }>(token, `/${id}/lines`, {
    method: 'PUT',
    body: JSON.stringify({ lines }),
  });
}

export function recalculateQtVersion(
  token: string,
  id: number,
  vid: string,
  includeFinance = false,
) {
  const suffix = includeFinance ? '?section=finance' : '';
  return qtFetch<QtRecalcResult>(token, `/${id}/versions/${encodeURIComponent(vid)}/recalculate${suffix}`, {
    method: 'POST',
  });
}

export function putQtPayments(token: string, vid: string, items: QtPaymentItem[]) {
  return qtFetch<{ version_id: string; items: QtPaymentItem[] }>(
    token,
    `/quote-versions/${encodeURIComponent(vid)}/payments`,
    { method: 'PUT', body: JSON.stringify({ items }) },
  );
}

export function getQtQuoteCatalog(token: string) {
  return qtFetch<unknown>(token, '/quote-catalog').then(asQtCatalogItems);
}

export async function qtFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  const isVersion = trimmed.startsWith('quote-versions/') || path.startsWith('/quote-versions/');
  const url = isVersion
    ? `${API_BASE}/api/crm/${trimmed}`
    : `${API_BASE}/api/crm/proposals${
        !path || path.startsWith('?') ? path : path.startsWith('/') ? path : `/${path}`
      }`;
  const res = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new QtApiError(body.error ?? body.message ?? 'QT request failed', res.status, body.error);
  }
  return body;
}
