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
  const suffix = path.startsWith('/') ? path : `/${path}`;
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
