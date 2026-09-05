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
  sla_policy_id?: string;
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

export type AmWorkInbox = 'me' | 'team' | 'unassigned' | 'all';

export type AmWorkQueueItem = AmTask & {
  account_name: string | null;
  assignee_label: string | null;
  sla_first_due_at: string | null;
  sla_resolve_due_at: string | null;
  sla_paused: boolean;
  sla_clock: number | 'paused' | null;
  overdue: boolean;
};

export type AmWorkQueueList = {
  items: AmWorkQueueItem[];
  counts: { me: number | null; team: number | null; unassigned: number | null };
  work_hours: string;
};

export type AmWorkQueueQuery = {
  inbox?: string;
  scope?: AmScope;
  sla?: string;
  kind?: string;
  status?: string;
  priority?: string;
  agency_client_id?: string;
};

export async function fetchAmWorkQueue(
  token: string,
  query: AmWorkQueueQuery = {},
): Promise<AmWorkQueueList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmWorkQueueList>(token, `/api/crm/am/tasks${suffix}`);
}

export async function acceptAmTasksBulk(
  token: string,
  ids: string[],
): Promise<{ accepted: number; items: AmTask[] }> {
  return amFetch<{ accepted: number; items: AmTask[] }>(token, '/api/crm/am/tasks/accept-bulk', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export type AmWorkEscalationLevel = 'lead' | 'director' | 'executive';

export type AmWorkItemDetail = AmWorkQueueItem & {
  waiting_client_reason: string | null;
  resolution_summary: string | null;
  resolution_category: string | null;
  escalation_level: string | null;
  csd_ticket_id: string | null;
  csd_href: string | null;
  suggested_escalation_level?: AmWorkEscalationLevel | null;
  created_at?: string | null;
};

export async function fetchAmWorkItem(token: string, id: string): Promise<AmWorkItemDetail> {
  return amFetch<AmWorkItemDetail>(token, `/api/crm/am/tasks/${encodeURIComponent(id)}`);
}

export async function waitingClientAmTask(
  token: string,
  id: string,
  body: { reason: string; evidence?: string },
): Promise<AmWorkItemDetail> {
  return amFetch<AmWorkItemDetail>(
    token,
    `/api/crm/am/tasks/${encodeURIComponent(id)}/waiting-client`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function resolveAmTask(
  token: string,
  id: string,
  body: { summary: string; category?: string },
): Promise<AmWorkItemDetail> {
  return amFetch<AmWorkItemDetail>(token, `/api/crm/am/tasks/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function escalateAmTask(
  token: string,
  id: string,
  body: {
    level: AmWorkEscalationLevel;
    recipient_staff_id: number;
    summary: string;
    reason?: string;
  },
): Promise<AmWorkItemDetail> {
  return amFetch<AmWorkItemDetail>(token, `/api/crm/am/tasks/${encodeURIComponent(id)}/escalate`, {
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
  override_reason?: string;
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

export type AmHealthOverride = {
  band: AmHealthBand;
  reason: string;
  until: string;
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
  override?: AmHealthOverride | null;
  contacts: AmAccountContact[];
  contracts: AmAccountContract[];
  open_tasks: AmAccountOpenTask[];
  plans: AmAccountPlan[];
  audit: AmAccountAuditItem[];
  recovery_required?: boolean;
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

export type AmAccountProjectContract = {
  id: number;
  title: string;
  service_slug: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  href: string;
};

export type AmAccountDeliveryLink = {
  id: string;
  name: string;
  href: string;
};

export type AmAccountProjects = {
  contracts: AmAccountProjectContract[];
  delivery: AmAccountDeliveryLink[];
};

export async function fetchAmAccountProjects(
  token: string,
  agencyClientId: string,
): Promise<AmAccountProjects> {
  return amFetch<AmAccountProjects>(
    token,
    `/api/crm/am/accounts/${encodeURIComponent(agencyClientId)}/projects`,
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

export type AmSettings = {
  weights: {
    kpi_delivery: number;
    engagement: number;
    financial: number;
    satisfaction: number;
    contract_support: number;
  };
  bands: {
    healthy: [number, number];
    watch: [number, number];
    at_risk: [number, number];
    critical: [number, number];
  };
  quota_accounts_per_am: number;
  watch_ends_on_days: number;
  health_drop_alert: number;
  rollup_parent_health: boolean;
  scorecard_version: number;
};

export type AmPublishSettingsBody = {
  weights: AmSettings['weights'];
  bands: AmSettings['bands'];
  quota_accounts_per_am?: number;
  watch_ends_on_days?: number;
  health_drop_alert?: number;
  rollup_parent_health?: boolean;
};

export async function fetchAmSettings(token: string): Promise<AmSettings> {
  return amFetch<AmSettings>(token, '/api/crm/am/settings');
}

export async function putAmSettings(token: string, body: AmPublishSettingsBody): Promise<AmSettings> {
  return amFetch<AmSettings>(token, '/api/crm/am/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export type AmCustomField = {
  id: string;
  api_key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'bool' | 'select';
  industry_slug: string | null;
  required: boolean;
  filterable: boolean;
  reportable: boolean;
  access_json: { view?: string[]; edit?: string[] } | null;
  constraints_json: { min?: number; max?: number } | null;
  published: boolean;
};

export type AmCreateFieldBody = {
  label: string;
  api_key: string;
  field_type: AmCustomField['field_type'];
  industry_slug?: string | null;
  required?: boolean;
  filterable?: boolean;
  reportable?: boolean;
  access_json?: AmCustomField['access_json'];
  constraints_json?: AmCustomField['constraints_json'];
};

export type AmPatchFieldBody = Partial<AmCreateFieldBody>;

export async function fetchAmFields(token: string, industry?: string): Promise<{ items: AmCustomField[] }> {
  const suffix = industry ? `?industry=${encodeURIComponent(industry)}` : '';
  return amFetch<{ items: AmCustomField[] }>(token, `/api/crm/am/fields${suffix}`);
}

export async function createAmField(token: string, body: AmCreateFieldBody): Promise<AmCustomField> {
  return amFetch<AmCustomField>(token, '/api/crm/am/fields', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAmField(
  token: string,
  id: string,
  body: AmPatchFieldBody,
): Promise<AmCustomField> {
  return amFetch<AmCustomField>(token, `/api/crm/am/fields/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function publishAmField(token: string, id: string): Promise<AmCustomField> {
  return amFetch<AmCustomField>(token, `/api/crm/am/fields/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
}

export async function fetchAmFieldValues(
  token: string,
  agencyClientId: string,
): Promise<{ values: Record<string, unknown> }> {
  return amFetch<{ values: Record<string, unknown> }>(
    token,
    `/api/crm/am/field-values/${encodeURIComponent(agencyClientId)}`,
  );
}

export async function putAmFieldValues(
  token: string,
  agencyClientId: string,
  body: { values: Record<string, unknown> },
): Promise<{ values: Record<string, unknown> }> {
  return amFetch<{ values: Record<string, unknown> }>(
    token,
    `/api/crm/am/field-values/${encodeURIComponent(agencyClientId)}`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export type AmSlaPolicy = {
  id: string;
  name: string;
  first_response_minutes: number;
  resolve_minutes: number;
  pause_on_waiting_client: boolean;
  escalate_json: Record<string, string>;
  workday_start: string;
  workday_end: string;
  workdays: number[];
  holidays: string[];
};

export type AmCreateSlaBody = {
  name: string;
  first_response_minutes: number;
  resolve_minutes: number;
  pause_on_waiting_client?: boolean;
  escalate_json?: Record<string, string>;
  workday_start?: string;
  workday_end?: string;
  workdays?: number[];
  holidays?: string[];
};

export async function fetchAmSlaPolicies(token: string): Promise<{ items: AmSlaPolicy[] }> {
  return amFetch<{ items: AmSlaPolicy[] }>(token, '/api/crm/am/sla-policies');
}

export async function createAmSlaPolicy(token: string, body: AmCreateSlaBody): Promise<AmSlaPolicy> {
  return amFetch<AmSlaPolicy>(token, '/api/crm/am/sla-policies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAmSlaPolicy(
  token: string,
  id: string,
  body: Partial<AmCreateSlaBody>,
): Promise<AmSlaPolicy> {
  return amFetch<AmSlaPolicy>(token, `/api/crm/am/sla-policies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type AmHealthCenterTiles = {
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  revenue_at_risk_vnd: number | null;
  open_risks: number;
};

export type AmHealthRiskyRow = {
  agency_client_id: string;
  name: string;
  score: number | null;
  band: 'at_risk' | 'critical';
  delta_30d: number | null;
  mrr_vnd: number | null;
  owner_label: string;
  open_risks: number;
  recovery_status: string | null;
};

export type AmHealthCenter = {
  hide_amounts: boolean;
  tiles: AmHealthCenterTiles;
  sla_pct?: number | null;
  sparkline: Array<{ as_of: string; avg: number | null }>;
  risky: AmHealthRiskyRow[];
};

export type AmHealthContribution = {
  key: string;
  score: number;
  weight: number;
  points: number;
};

export type AmHealthDetail = {
  agency_client_id: string;
  name: string;
  score: number | null;
  band: AmHealthBand | null;
  as_of: string | null;
  scorecard_version: number | null;
  thin_data: boolean;
  override: AmHealthOverride | null;
  weights: {
    kpi_delivery: number;
    engagement: number;
    financial: number;
    satisfaction: number;
    contract_support: number;
  };
  components: {
    kpi_delivery: number;
    engagement: number;
    financial: number;
    satisfaction: number;
    contract_support: number;
  } | null;
  contribution: AmHealthContribution[];
  trend: Array<{ as_of: string; score: number | null }>;
  signals: string[];
  recovery_required?: boolean;
};

export async function fetchAmHealthCenter(
  token: string,
  query: AmCommandCenterQuery = {},
): Promise<AmHealthCenter> {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmHealthCenter>(token, `/api/crm/am/health${suffix}`);
}

export async function fetchAmHealthDetail(token: string, agencyClientId: string): Promise<AmHealthDetail> {
  return amFetch<AmHealthDetail>(token, `/api/crm/am/health/${encodeURIComponent(agencyClientId)}`);
}

export async function recomputeAmHealth(
  token: string,
  body: { as_of?: string } = {},
): Promise<{ as_of: string; computed: number; skipped: number }> {
  return amFetch(token, '/api/crm/am/health/recompute', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function overrideAmHealth(
  token: string,
  agencyClientId: string,
  body: { band: AmHealthBand; reason: string; until: string },
): Promise<{ agency_client_id: string; band: AmHealthBand; reason: string; until: string }> {
  return amFetch(token, `/api/crm/am/health/${encodeURIComponent(agencyClientId)}/override`, {
    method: 'POST',
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

export type AmRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AmRisk = {
  id: string;
  agency_client_id: string;
  category: string;
  severity: AmRiskSeverity;
  probability: number | null;
  impact: number | null;
  evidence: string;
  owner_staff_id: number | null;
  due_on: string | null;
  status: string;
  created_at: string;
};

export type AmRecoveryPlan = {
  id: string;
  agency_client_id: string;
  risk_id: string | null;
  goal: string;
  rca: string | null;
  actions: unknown[];
  exit_criteria: string | null;
  outcome: string | null;
  lesson: string | null;
  status: string;
  created_at: string;
};

export type AmCreateRiskInput = {
  agency_client_id: string;
  category: string;
  severity: string;
  probability?: number;
  impact?: number;
  evidence: string;
  owner_staff_id?: number;
  due_on?: string;
};

export type AmCreateRecoveryInput = {
  agency_client_id: string;
  risk_id?: string;
  goal: string;
  rca?: string;
  actions?: unknown[];
  exit_criteria?: string;
};

export async function fetchAmRisks(
  token: string,
  query: { agency_client_id: string; scope?: AmScope },
): Promise<{ items: AmRisk[] }> {
  const params = new URLSearchParams();
  params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  return amFetch<{ items: AmRisk[] }>(token, `/api/crm/am/risks?${params.toString()}`);
}

export async function createAmRisk(token: string, body: AmCreateRiskInput): Promise<AmRisk> {
  return amFetch<AmRisk>(token, '/api/crm/am/risks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAmRecoveryPlans(
  token: string,
  query: { agency_client_id: string; scope?: AmScope },
): Promise<{ items: AmRecoveryPlan[] }> {
  const params = new URLSearchParams();
  params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  return amFetch<{ items: AmRecoveryPlan[] }>(token, `/api/crm/am/recovery-plans?${params.toString()}`);
}

export async function createAmRecoveryPlan(
  token: string,
  body: AmCreateRecoveryInput,
): Promise<AmRecoveryPlan> {
  return amFetch<AmRecoveryPlan>(token, '/api/crm/am/recovery-plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function closeAmRecoveryPlan(
  token: string,
  id: string,
  body: { outcome: string; lesson: string },
): Promise<AmRecoveryPlan> {
  return amFetch<AmRecoveryPlan>(token, `/api/crm/am/recovery-plans/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AmOppStage = 'qualify' | 'propose' | 'negotiate' | 'won' | 'lost';

export type AmOpportunity = {
  id: string;
  agency_client_id: string;
  account_name: string | null;
  title: string;
  kind: string | null;
  package: string | null;
  value_vnd: number | null;
  probability: number | null;
  stage: AmOppStage;
  next_step: string;
  source: string;
  ai_evidence_json: unknown;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
};

export type AmOpportunityKpis = {
  pipeline_vnd: number | null;
  weighted_vnd: number | null;
  won_month_vnd: number | null;
};

export type AmOpportunitySuggestion = {
  agency_client_id?: string;
  account_name?: string | null;
  title?: string;
  kind?: string | null;
  package?: string | null;
  value_vnd?: number | null;
  probability?: number | null;
  next_step?: string;
  ai_evidence_json?: unknown;
};

export type AmOpportunitiesList = {
  items: AmOpportunity[];
  kpis: AmOpportunityKpis;
  suggestions: AmOpportunitySuggestion[];
};

export type AmCreateOpportunityInput = {
  agency_client_id: string;
  title: string;
  kind?: string;
  package?: string;
  value_vnd?: number | null;
  probability?: number | null;
  stage?: AmOppStage;
  next_step: string;
  source?: string;
  ai_evidence_json?: unknown;
};

export type AmPatchOpportunityInput = Partial<Omit<AmCreateOpportunityInput, 'agency_client_id'>>;

export type AmReportsRetention = {
  period: { from: string; to: string };
  freshness: { as_of: string; stale: boolean };
  kpis: {
    logo: number | null;
    grr: number | null;
    nrr: number | null;
    churned_mrr: number | null;
    expansion_mrr: number | null;
  };
  nrr_hidden: boolean;
  note: string | null;
  formulas: { logo: string; grr: string; nrr: string };
  drills: {
    logo: string;
    grr: string;
    nrr: string | null;
    churned_mrr: string;
    expansion_mrr: string | null;
  };
  cohort: Array<{
    cohort: string;
    cells: Array<{ period: string; rate: number | null; href: string }>;
  }>;
  forecast: Array<{
    bucket: 'committed' | 'likely' | 'risk' | 'unlikely';
    value_vnd: number | null;
    href: string;
  }>;
  churn_reasons: Array<{ reason: string; count: number; mrr: number | null; href: string }>;
  by_owner: Array<{
    owner_staff_id: number | null;
    logo: number | null;
    grr: number | null;
    href: string;
  }>;
};

export async function fetchAmRetentionReports(
  token: string,
  query: AmCommandCenterQuery = {},
): Promise<AmReportsRetention> {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmReportsRetention>(token, `/api/crm/am/reports/retention${suffix}`);
}

export async function fetchAmOpportunities(
  token: string,
  query: { agency_client_id?: string; scope?: AmScope; stage?: string } = {},
): Promise<AmOpportunitiesList> {
  const params = new URLSearchParams();
  if (query.agency_client_id) params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  if (query.stage) params.set('stage', query.stage);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmOpportunitiesList>(token, `/api/crm/am/opportunities${suffix}`);
}

export async function createAmOpportunity(
  token: string,
  body: AmCreateOpportunityInput,
): Promise<AmOpportunity> {
  return amFetch<AmOpportunity>(token, '/api/crm/am/opportunities', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAmOpportunity(
  token: string,
  id: string,
  body: AmPatchOpportunityInput,
): Promise<AmOpportunity> {
  return amFetch<AmOpportunity>(token, `/api/crm/am/opportunities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
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

export async function markAmNotificationRead(
  token: string,
  id: string,
): Promise<{ id: string; read_at: string }> {
  return amFetch<{ id: string; read_at: string }>(
    token,
    `/api/crm/am/notifications/${encodeURIComponent(id)}/read`,
    { method: 'POST', body: '{}' },
  );
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

export type AmOnboardingItemKind = 'checklist' | 'milestone';
export type AmOnboardingCaseStatus = 'open' | 'closed';
export type AmOnboardingTrack = 'on_track' | 'at_risk' | 'blocked';
export type AmOnboardingTemplateStatus = 'draft' | 'published';

export type AmOnboardingTemplateItem = {
  id: string;
  kind: AmOnboardingItemKind;
  phase: string;
  title: string;
  owner_role: string;
  due_offset_days: number;
  required: boolean;
};

export type AmOnboardingCaseItem = AmOnboardingTemplateItem & {
  done: boolean;
  done_at: string | null;
  due_on: string | null;
};

export type AmOnboardingCase = {
  id: string;
  agency_client_id: string;
  name: string;
  code: string;
  status: AmOnboardingCaseStatus;
  go_live_on: string | null;
  override_reason: string | null;
  items: AmOnboardingCaseItem[];
  progress_pct: number | null;
  owner_name: string | null;
  delivery_owner: string | null;
  track: AmOnboardingTrack;
  health_fresh_24h: boolean;
  stakeholders: Record<string, unknown>;
  activity: unknown[];
  documents: unknown[];
};

export type AmOnboardingTemplate = {
  id: string;
  name: string;
  version: number;
  status: AmOnboardingTemplateStatus;
  items: AmOnboardingTemplateItem[];
};

export async function fetchAmOnboardingCase(token: string, id: string): Promise<AmOnboardingCase> {
  return amFetch<AmOnboardingCase>(token, `/api/crm/am/onboarding-cases/${encodeURIComponent(id)}`);
}

export async function patchAmOnboardingCase(
  token: string,
  id: string,
  items: Array<{ id: string; done: boolean }>,
): Promise<AmOnboardingCase> {
  return amFetch<AmOnboardingCase>(token, `/api/crm/am/onboarding-cases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
}

export async function goLiveAmOnboardingCase(
  token: string,
  id: string,
  body: { go_live_on: string; override?: boolean; override_reason?: string; notes?: string },
): Promise<AmOnboardingCase> {
  return amFetch<AmOnboardingCase>(
    token,
    `/api/crm/am/onboarding-cases/${encodeURIComponent(id)}/go-live`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function fetchAmOnboardingTemplates(
  token: string,
): Promise<{ items: AmOnboardingTemplate[] }> {
  return amFetch<{ items: AmOnboardingTemplate[] }>(token, '/api/crm/am/onboarding-templates');
}

export async function createAmOnboardingTemplate(
  token: string,
  body: { name: string; items: AmOnboardingTemplateItem[] },
): Promise<AmOnboardingTemplate> {
  return amFetch<AmOnboardingTemplate>(token, '/api/crm/am/onboarding-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAmOnboardingTemplate(
  token: string,
  id: string,
  body: { name?: string; items?: AmOnboardingTemplateItem[] },
): Promise<AmOnboardingTemplate> {
  return amFetch<AmOnboardingTemplate>(
    token,
    `/api/crm/am/onboarding-templates/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function cloneAmOnboardingTemplate(
  token: string,
  id: string,
): Promise<AmOnboardingTemplate> {
  return amFetch<AmOnboardingTemplate>(
    token,
    `/api/crm/am/onboarding-templates/${encodeURIComponent(id)}/clone`,
    { method: 'POST' },
  );
}

export async function publishAmOnboardingTemplate(
  token: string,
  id: string,
): Promise<AmOnboardingTemplate> {
  return amFetch<AmOnboardingTemplate>(
    token,
    `/api/crm/am/onboarding-templates/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
  );
}

export type AmContractListItem = {
  id: number;
  reference_code: string;
  title: string;
  status: string;
  billing_type: string;
  service_slug: string;
  starts_on: string | null;
  ends_on: string | null;
  days_remaining: number | null;
  amount_vnd: number | null;
  mrr_vnd: number | null;
  agency_client_id: string;
  client_name: string;
  client_code: string;
  hide_amounts: boolean;
};

export type AmContractLineItem = {
  service_slug: string;
  title: string;
  amount_vnd: number | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

export type AmContractAuditItem = {
  event_type: string;
  actor: string;
  created_at: string;
  payload_json: Record<string, unknown> | null;
};

export type AmContractDetail = AmContractListItem & {
  notes: string;
  renewal_reminder_days: number | null;
  signed_on: string | null;
  line_items: AmContractLineItem[];
  obligations: unknown[];
  payment_schedule: unknown[];
  amendments: unknown[];
  documents: unknown[];
  renewal: {
    ends_on: string | null;
    days_remaining: number | null;
    open_case_id: string | null;
  };
  audit: AmContractAuditItem[];
};

export type AmContractsListQuery = {
  agency_client_id?: string;
  scope?: AmScope;
};

export async function fetchAmContracts(
  token: string,
  query: AmContractsListQuery = {},
): Promise<{ items: AmContractListItem[] }> {
  const params = new URLSearchParams();
  if (query.agency_client_id) params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<{ items: AmContractListItem[] }>(token, `/api/crm/am/contracts${suffix}`);
}

export async function fetchAmContract(token: string, id: string): Promise<AmContractDetail> {
  return amFetch<AmContractDetail>(token, `/api/crm/am/contracts/${encodeURIComponent(id)}`);
}

export type AmRenewalStatus =
  | 'not_started'
  | 'evaluating'
  | 'negotiating'
  | 'decided'
  | 'renewed'
  | 'lost'
  | 'paused';

export type AmRenewalForecast = 'committed' | 'likely' | 'risk' | 'unlikely';

export type AmRenewalCard = {
  id: string;
  agency_client_id: string;
  name: string;
  owner_label: string;
  status: AmRenewalStatus;
  forecast: AmRenewalForecast | null;
  forecast_pct: number | null;
  next_action: string | null;
  mrr_vnd: number | null;
  days_remaining: number | null;
  score: number | null;
  band: AmHealthBand | null;
  ends_on: string | null;
  contract_id: number;
};

export type AmRenewalColumn = {
  id: string;
  label: string;
  count: number;
  mrr_vnd: number | null;
  items: AmRenewalCard[];
};

export type AmRenewalPipeline = {
  hide_amounts: boolean;
  header: {
    renewable_vnd: number | null;
    weighted_vnd: number | null;
    at_risk_vnd: number | null;
  };
  columns: AmRenewalColumn[];
};

export type AmRenewalCase = AmRenewalCard & {
  hide_amounts: boolean;
  contract_ref: string;
  lost_reason: string | null;
  lost_on: string | null;
  lessons: string | null;
  new_contract_id: number | null;
};

export type AmRenewalsListQuery = {
  scope?: AmScope;
  window?: string;
};

export type AmPatchRenewalBody = {
  status?: AmRenewalStatus;
  forecast?: AmRenewalForecast | null;
  forecast_pct?: number | null;
  next_action?: string | null;
  lost_reason?: string;
  lost_on?: string;
  lessons?: string;
  new_contract_id?: number | null;
  recoverable?: boolean;
  override?: boolean;
};

export async function fetchAmRenewals(
  token: string,
  query: AmRenewalsListQuery = {},
): Promise<AmRenewalPipeline> {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.window) params.set('window', query.window);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmRenewalPipeline>(token, `/api/crm/am/renewals${suffix}`);
}

export async function fetchAmRenewal(token: string, id: string): Promise<AmRenewalCase> {
  return amFetch<AmRenewalCase>(token, `/api/crm/am/renewals/${encodeURIComponent(id)}`);
}

export async function startAmRenewal(token: string, contractId: number): Promise<AmRenewalCase> {
  return amFetch<AmRenewalCase>(token, '/api/crm/am/renewals', {
    method: 'POST',
    body: JSON.stringify({ contract_id: contractId }),
  });
}

export async function patchAmRenewal(
  token: string,
  id: string,
  body: AmPatchRenewalBody,
): Promise<AmRenewalCase> {
  return amFetch<AmRenewalCase>(token, `/api/crm/am/renewals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type AmInteractionKind = 'note' | 'call' | 'meeting' | 'email' | 'system';

export type AmInteractionActionItem = {
  title: string;
  done?: boolean;
  due_at?: string;
};

export type AmInteraction = {
  id: string;
  agency_client_id: string;
  kind: AmInteractionKind;
  occurred_at: string;
  actor_staff_id: number | null;
  summary: string;
  sentiment: string | null;
  visibility: string;
  attendees: string[];
  action_items: AmInteractionActionItem[];
  created_at: string;
  editable: boolean;
};

export type AmCreateInteractionInput = {
  agency_client_id: string;
  kind: Exclude<AmInteractionKind, 'system'>;
  occurred_at?: string;
  summary: string;
  sentiment?: string;
  visibility?: string;
  attendees?: string[];
  action_items?: AmInteractionActionItem[];
};

export type AmPatchInteractionInput = {
  summary?: string;
  sentiment?: string | null;
  visibility?: string;
  attendees?: string[];
  action_items?: AmInteractionActionItem[];
};

export async function fetchAmInteractions(
  token: string,
  query: { agency_client_id: string; scope?: AmScope },
): Promise<{ items: AmInteraction[] }> {
  const params = new URLSearchParams();
  params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  return amFetch<{ items: AmInteraction[] }>(token, `/api/crm/am/interactions?${params.toString()}`);
}

export async function createAmInteraction(
  token: string,
  body: AmCreateInteractionInput,
): Promise<AmInteraction> {
  return amFetch<AmInteraction>(token, '/api/crm/am/interactions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchAmInteraction(
  token: string,
  id: string,
  body: AmPatchInteractionInput,
): Promise<AmInteraction> {
  return amFetch<AmInteraction>(token, `/api/crm/am/interactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type AmFinanceInvoice = {
  id: string | number;
  number: string | null;
  status: string | null;
  issued_on: string | null;
  due_on: string | null;
  amount_vnd: number | null;
  paid_vnd: number | null;
  aging_days: number | null;
};

export type AmFinanceSnapshot = {
  hidden: boolean;
  stale: boolean;
  source: string | null;
  last_sync: string | null;
  erp_href: '/crm/invoices';
  kpis: {
    mrr_vnd: number | null;
    active_total_vnd: number | null;
    outstanding_vnd: number | null;
    overdue_vnd: number | null;
    next_invoice_on: string | null;
    next_invoice_vnd: number | null;
  };
  invoices: AmFinanceInvoice[];
};

export async function fetchAmFinance(token: string, agencyClientId: string): Promise<AmFinanceSnapshot> {
  return amFetch<AmFinanceSnapshot>(token, `/api/crm/am/finance/${encodeURIComponent(agencyClientId)}`);
}

export type AmFeedbackKind = 'csat' | 'nps' | 'complaint' | 'response' | 'comment';

export type AmFeedbackItem = {
  id: string;
  agency_client_id: string;
  account_name: string | null;
  kind: AmFeedbackKind;
  score: number | null;
  comment: string | null;
  followup_task_id: string | null;
  csd_ticket_id: string | null;
  csd_href: string | null;
  created_at: string;
};

export type AmFeedbackKpis = {
  csat: number | null;
  nps: number | null;
  response_pct: number | null;
  complaints_open: number | null;
};

export type AmFeedbackList = {
  items: AmFeedbackItem[];
  kpis: AmFeedbackKpis;
};

export type AmCreateFeedbackInput = {
  agency_client_id: string;
  kind: AmFeedbackKind;
  score?: number | null;
  comment?: string | null;
  csd_ticket_id?: string | null;
};

export type AmSurvey = {
  id: string;
  name: string;
  template: string;
  channel: string | null;
  audience_json: unknown;
  no_recontact_days: number | null;
  csat_task_threshold: number;
  created_at: string;
};

export type AmCreateSurveyInput = {
  name: string;
  template: string;
  channel?: string | null;
  audience_json?: unknown;
  no_recontact_days?: number | null;
  csat_task_threshold?: number | null;
};

export async function fetchAmFeedback(
  token: string,
  query: { agency_client_id?: string; scope?: AmScope; kind?: string } = {},
): Promise<AmFeedbackList> {
  const params = new URLSearchParams();
  if (query.agency_client_id) params.set('agency_client_id', query.agency_client_id);
  if (query.scope) params.set('scope', query.scope);
  if (query.kind) params.set('kind', query.kind);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return amFetch<AmFeedbackList>(token, `/api/crm/am/feedback${suffix}`);
}

export async function createAmFeedback(
  token: string,
  body: AmCreateFeedbackInput,
): Promise<AmFeedbackItem> {
  return amFetch<AmFeedbackItem>(token, '/api/crm/am/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function followupAmFeedback(
  token: string,
  id: string,
  body: { csd_ticket_id?: string } = {},
): Promise<AmFeedbackItem> {
  return amFetch<AmFeedbackItem>(token, `/api/crm/am/feedback/${encodeURIComponent(id)}/followup`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AmAiKind = 'summary' | 'health' | 'qbr' | 'followup';

export type AmAiStatus = { enabled: boolean };

export type AmAiDraft = {
  draft: string;
  evidence: unknown;
  draft_id: string;
};

export type AmAiDraftInput = {
  agency_client_id: string;
  kind: AmAiKind;
  prompt?: string;
};

export type AmAiFeedbackInput = {
  draft_id?: string;
  kind: AmAiKind;
  rating: 'up' | 'down';
};

export async function fetchAmAiStatus(token: string): Promise<AmAiStatus> {
  return amFetch<AmAiStatus>(token, '/api/crm/am/ai/status');
}

export async function createAmAiDraft(token: string, body: AmAiDraftInput): Promise<AmAiDraft> {
  return amFetch<AmAiDraft>(token, '/api/crm/am/ai/draft', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postAmAiFeedback(
  token: string,
  body: AmAiFeedbackInput,
): Promise<{ ok: boolean }> {
  return amFetch<{ ok: boolean }>(token, '/api/crm/am/ai/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAmSurveys(token: string): Promise<{ items: AmSurvey[] }> {
  return amFetch<{ items: AmSurvey[] }>(token, '/api/crm/am/surveys');
}

export async function createAmSurvey(token: string, body: AmCreateSurveyInput): Promise<AmSurvey> {
  return amFetch<AmSurvey>(token, '/api/crm/am/surveys', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
