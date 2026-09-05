import { API_BASE, ApiError, parseJson } from '@/lib/api';
import type { AmHealthBand } from './am-format';

export type AmScope = 'me' | 'team' | 'all';
export type AmRole = 'am' | 'director' | 'admin';

export type AmCommandCenter = {
  period: { from: string; to: string };
  scope: AmScope;
  freshness: { as_of: string; stale: boolean; work_left_label: string | null };
  role: AmRole;
  load: { accounts: number; quota: number };
  kpis: {
    active_accounts: number | null;
    mrr_vnd: number | null;
    renewal_90d_vnd: number | null;
    renewal_90d_count: number | null;
    revenue_at_risk_vnd: number | null;
    revenue_at_risk_count: number | null;
    sla_overdue: number | null;
    csat: number | null;
    deltas?: Partial<Record<string, number>>;
  };
  coverage: null | {
    avg_load: number | null;
    unassigned: number;
    delegated: number;
    qbr_this_week: number;
  };
  today_work: Array<{
    id: string;
    due_at: string | null;
    title: string;
    account_name: string;
    sla_label: string | null;
    chip: 'overdue' | 'today' | 'soon' | 'unassigned';
    can_accept: boolean;
  }>;
  attention: Array<{
    agency_client_id: string;
    name: string;
    parent_name: string | null;
    band: AmHealthBand;
    score: number | null;
    mrr_vnd: number | null;
    days_to_end: number | null;
  }>;
  forecast: {
    committed_vnd: number | null;
    likely_vnd: number | null;
    risk_vnd: number | null;
    unlikely_vnd: number | null;
  };
  health_dist: {
    healthy: number;
    watch: number;
    at_risk: number;
    critical: number;
    avg: number | null;
  };
  my_book: Array<{
    agency_client_id: string;
    name: string;
    is_parent: boolean;
    child_count: number;
    owner_label: string;
    package_label: string;
    score: number | null;
    band: AmHealthBand | null;
    mrr_vnd: number | null;
    ends_on: string | null;
    next_action: string | null;
  }>;
};

export type AmCommandCenterQuery = {
  scope?: AmScope;
  from?: string;
  to?: string;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function amFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'AM request failed', res.status);
  }
  return body;
}

export type AmTaskKind =
  | 'task'
  | 'client_request'
  | 'issue'
  | 'escalation'
  | 'approval'
  | 'milestone';

export type AmTaskPriority = 'low' | 'medium' | 'high';

export type AmCreateTaskInput = {
  agency_client_id: string;
  title: string;
  kind?: AmTaskKind;
  priority?: AmTaskPriority;
  due_at?: string;
  source?: string;
  source_ref?: string;
};

export type AmTask = {
  id: string;
  agency_client_id: string;
  title: string;
  kind: AmTaskKind;
  priority: AmTaskPriority;
  status: string;
  assignee_staff_id: number | null;
  due_at: string | null;
  source: string;
  source_ref: string | null;
};

export async function acceptAmTask(token: string, id: string): Promise<AmTask> {
  return amFetch<AmTask>(token, `/api/crm/am/tasks/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  });
}

export async function createAmTask(token: string, body: AmCreateTaskInput): Promise<AmTask> {
  return amFetch<AmTask>(token, '/api/crm/am/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AmPlanKind = 'care' | 'qbr' | 'renewal' | 'expand';

export type AmCreateAccountBody =
  | { mode: 'create'; code: string; name: string; industry_slug?: string; owner_am_id?: string }
  | { mode: 'attach'; agency_client_id: string; owner_staff_id?: number };

export type AmAccountResult = {
  agency_client_id: string;
  mode: 'create' | 'attach';
  client?: { id: string; code: string; name: string };
};

export type AmCreatePlanInput = {
  agency_client_id: string;
  kind: AmPlanKind;
  period_key: string;
  contract_id?: number;
  due_on?: string;
};

export type AmPlan = {
  id: string;
  agency_client_id: string;
  contract_id: number | null;
  kind: AmPlanKind;
  period_key: string;
  status: string;
  owner_staff_id: number;
  due_on: string | null;
};

export async function createAmAccount(token: string, body: AmCreateAccountBody): Promise<AmAccountResult> {
  return amFetch<AmAccountResult>(token, '/api/crm/am/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createAmPlan(token: string, body: AmCreatePlanInput): Promise<AmPlan> {
  return amFetch<AmPlan>(token, '/api/crm/am/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAmCommandCenter(
  token: string,
  query: AmCommandCenterQuery = {},
): Promise<AmCommandCenter> {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmCommandCenter>(token, `/api/crm/am/command-center${suffix}`);
}
