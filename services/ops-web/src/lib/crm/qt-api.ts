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
  const suffix =
    !path || path.startsWith('?') ? path : path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}/api/crm/proposals${suffix}`, {
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
