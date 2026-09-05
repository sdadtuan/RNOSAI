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

export type AmAccountListItem = {
  agency_client_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  is_parent: boolean;
  child_count: number;
  owner_staff_id: number | null;
  owner_label: string | null;
  delegated_until: string | null;
  team_label: string | null;
  am_status: string;
  band: AmHealthBand | null;
  score: number | null;
  mrr_vnd: number | null;
  ends_on: string | null;
  sla_label: string | null;
};

export type AmAccountsList = {
  items: AmAccountListItem[];
  total: number;
  page: number;
};

export type AmAccountsListQuery = {
  scope?: AmScope;
  q?: string;
  owner?: string;
  team?: string;
  band?: string;
  lifecycle?: string;
  industry?: string;
  sort?: string;
  page?: string;
  page_size?: string;
  parent?: string;
  ends_within?: string;
};

export type AmSavedView = {
  id: string;
  name: string;
  shared: boolean;
  page: string;
  query_json: Record<string, string | undefined>;
  owner_staff_id: number;
  created_at: string;
};

export type AmCreateViewBody = {
  name: string;
  shared?: boolean;
  page?: string;
  query_json?: Record<string, string>;
};

export async function fetchAmViews(token: string): Promise<{ items: AmSavedView[] }> {
  return amFetch<{ items: AmSavedView[] }>(token, '/api/crm/am/views');
}

export async function createAmView(token: string, body: AmCreateViewBody): Promise<AmSavedView> {
  return amFetch<AmSavedView>(token, '/api/crm/am/views', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AmTransferBody = {
  agency_client_ids: string[];
  to_staff_id: number;
  reason: string;
  keep_secondary?: boolean;
  backup_staff_id?: number;
  move_open_tasks?: boolean;
};

export type AmTransferResult = {
  transferred: number;
  to_staff_id: number;
  moved_tasks: number;
  keep_secondary: boolean;
};

export async function transferAmAccounts(token: string, body: AmTransferBody): Promise<AmTransferResult> {
  return amFetch<AmTransferResult>(token, '/api/crm/am/accounts/transfer', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAmAccounts(
  token: string,
  query: AmAccountsListQuery = {},
): Promise<AmAccountsList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  if (!params.has('page_size')) params.set('page_size', '50');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmAccountsList>(token, `/api/crm/am/accounts${suffix}`);
}

export async function createAmAccount(token: string, body: AmCreateAccountBody): Promise<AmAccountResult> {
  return amFetch<AmAccountResult>(token, '/api/crm/am/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AmAccountChild = {
  agency_client_id: string;
  name: string;
  code: string;
  owner_label: string | null;
  am_status: string;
};

export type AmAccountContact = {
  id: string;
  full_name: string;
  role_committee: string | null;
  is_primary: boolean;
  sentiment: string | null;
  channel: string | null;
  renewal_attitude: string | null;
  email: string | null;
  phone: string | null;
};

export type AmContactInput = {
  id?: string;
  full_name: string;
  role_committee?: string | null;
  is_primary?: boolean;
  sentiment?: string | null;
  channel?: string | null;
  email?: string | null;
  phone?: string | null;
  renewal_attitude?: string | null;
};

export type AmAccountContract = {
  id: number;
  reference_code: string;
  title: string;
  status: string;
  billing_type: string;
  service_slug: string;
  starts_on: string | null;
  ends_on: string | null;
  amount_vnd: number | null;
};

export type AmAccountOpenTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  sla_label: string | null;
};

export type AmAccountPlan = {
  id: string;
  kind: string;
  period_key: string;
  status: string;
  due_on: string | null;
};

export type AmAccountAuditItem = {
  id: number;
  action: string;
  entity_type: string;
  actor_staff_id: number | null;
  created_at: string;
  payload_json: Record<string, unknown> | null;
};

export type AmAccount360 = {
  agency_client_id: string;
  code: string;
  name: string;
  industry: string | null;
  notes: string | null;
  am_status: string;
  tier: string | null;
  team_id: number | null;
  team_label: string | null;
  owner_staff_id: number | null;
  owner_label: string | null;
  delivery_label: string | null;
  media_label: string | null;
  parent_agency_client_id: string | null;
  parent_name: string | null;
  children: AmAccountChild[];
  band: AmHealthBand | null;
  score: number | null;
  mrr_vnd: number | null;
  outstanding_vnd: number | null;
  next_invoice_on: string | null;
  hide_amounts: boolean;
  name_unchanged?: boolean;
  contacts: AmAccountContact[];
  contracts: AmAccountContract[];
  open_tasks: AmAccountOpenTask[];
  plans: AmAccountPlan[];
  audit: AmAccountAuditItem[];
};

export type AmPatchAccountBody = {
  name?: string;
  tier?: string | null;
  team_id?: number | null;
  am_status?: string;
  parent_agency_client_id?: string | null;
  archive?: boolean;
  owner_staff_id?: number | null;
  industry?: string | null;
  industry_override?: string | null;
  tags?: string[];
  contacts?: AmContactInput[];
};

export async function fetchAmAccount(token: string, agencyClientId: string): Promise<AmAccount360> {
  return amFetch<AmAccount360>(
    token,
    `/api/crm/am/accounts/${encodeURIComponent(agencyClientId)}`,
  );
}

export async function patchAmAccount(
  token: string,
  agencyClientId: string,
  body: AmPatchAccountBody,
): Promise<AmAccount360> {
  return amFetch<AmAccount360>(token, `/api/crm/am/accounts/${encodeURIComponent(agencyClientId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function mergeAmAccount(
  token: string,
  agencyClientId: string,
  intoAgencyClientId: string,
): Promise<{ merged: true; into_agency_client_id: string }> {
  return amFetch(token, `/api/crm/am/accounts/${encodeURIComponent(agencyClientId)}/merge`, {
    method: 'POST',
    body: JSON.stringify({ into_agency_client_id: intoAgencyClientId }),
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

export type AmSearchGroup = 'account' | 'contract' | 'task';

export type AmSearchItem = {
  group: AmSearchGroup;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export async function fetchAmSearch(
  token: string,
  query: { q: string; scope?: AmScope },
): Promise<{ items: AmSearchItem[] }> {
  const params = new URLSearchParams();
  params.set('q', query.q);
  if (query.scope) params.set('scope', query.scope);
  return amFetch<{ items: AmSearchItem[] }>(token, `/api/crm/am/search?${params.toString()}`);
}

export type AmNotificationItem = {
  id: string;
  kind: string;
  title: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type AmNotifications = {
  items: AmNotificationItem[];
  unread: number;
};

export async function fetchAmNotifications(token: string): Promise<AmNotifications> {
  return amFetch<AmNotifications>(token, '/api/crm/am/notifications');
}

export type AmHandoverStatus = 'draft' | 'pending_am' | 'accepted' | 'rejected' | 'needs_info';

export type AmHandoverChecklist = {
  understood_scope?: boolean;
  stakeholders_access?: boolean;
  delivery_owner?: boolean;
};

export type AmHandover = {
  id: string;
  agency_client_id: string;
  status: AmHandoverStatus;
  commercial_json: Record<string, unknown>;
  scope_json: Record<string, unknown>;
  stakeholders_json: Record<string, unknown>;
  reject_reason: string | null;
  accepted_by_staff_id: number | null;
  accepted_at: string | null;
  name: string;
  code: string;
  am_status: string;
  onboarding_case_id?: string | null;
};

export type AmHandoverListQuery = {
  scope?: AmScope;
  agency_client_id?: string;
  status?: string;
};

export async function fetchAmHandovers(
  token: string,
  query: AmHandoverListQuery = {},
): Promise<{ items: AmHandover[] }> {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.agency_client_id) params.set('agency_client_id', query.agency_client_id);
  if (query.status) params.set('status', query.status);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<{ items: AmHandover[] }>(token, `/api/crm/am/handovers${suffix}`);
}

export async function fetchAmHandover(token: string, id: string): Promise<AmHandover> {
  return amFetch<AmHandover>(token, `/api/crm/am/handovers/${encodeURIComponent(id)}`);
}

export async function acceptAmHandover(
  token: string,
  id: string,
  checklist: AmHandoverChecklist,
): Promise<AmHandover> {
  return amFetch<AmHandover>(token, `/api/crm/am/handovers/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ checklist }),
  });
}

export async function rejectAmHandover(token: string, id: string, reason: string): Promise<AmHandover> {
  return amFetch<AmHandover>(token, `/api/crm/am/handovers/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function needsInfoAmHandover(
  token: string,
  id: string,
  reason: string,
): Promise<AmHandover> {
  return amFetch<AmHandover>(token, `/api/crm/am/handovers/${encodeURIComponent(id)}/needs-info`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
