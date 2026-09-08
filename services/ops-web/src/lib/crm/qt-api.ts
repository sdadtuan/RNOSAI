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

export type QtCatalogDrawerTabId =
  | 'overview'
  | 'deliverable'
  | 'kpi'
  | 'timeline'
  | 'pricing'
  | 'policy';

export type QtCatalogItem = {
  dv_code: string;
  name?: string | null;
  name_vi?: string | null;
  status?: string;
  can_add_to_client_quote?: boolean;
  group?: string;
  template_key?: string;
  service_slug?: string;
  package_tiers?: Array<{
    tier: string;
    suggested_vnd?: number | null;
    rate_missing?: boolean;
  }>;
  catalog_snapshot_json?: Record<string, unknown>;
  drawer?: {
    overview?: {
      included?: string[] | null;
      excluded?: string[] | null;
      cta?: string | null;
      uta?: string | null;
      owner?: string | null;
      effort?: string | null;
    };
    deliverable?: { items?: string[] | null };
    kpi?: { committed?: string | null; optimization?: string | null; forecast?: string | null };
    timeline?: { kickoff?: string | null; duration?: string | null; notes?: string | null };
    pricing?: {
      restricted?: boolean;
      package_tiers?: QtCatalogItem['package_tiers'];
      cost_labor_vnd?: number | null;
    };
    policy?: { client_visible?: boolean; studio_sections?: string[] };
  };
};

export type QtIndustryPackage = {
  key: string;
  name: string;
  package_discount_bps: number;
  line_count: number;
  dv_codes: string[];
  can_add?: boolean;
};

export type QtRateCard = {
  id: string;
  dv_code: string;
  package_tier: string;
  fee_vnd: number;
  cost_labor_vnd?: number | null;
  effective_from: string;
  effective_to: string | null;
  state: string;
  rate_expired: boolean;
};

export type QtCatalogDoc = {
  services?: QtCatalogItem[];
  families?: QtCatalogItem[];
  packages?: QtIndustryPackage[];
  rate_cards?: QtRateCard[];
  drawer_tabs?: Array<{ id: string; label: string }>;
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

export type QtOptionKey = 'A' | 'B' | 'C';

export type QtQuoteOption = {
  id?: string;
  version_id?: string;
  option_key: QtOptionKey | string;
  name: string;
  recommended: boolean;
  client_visible: boolean;
  payable_vnd?: number | null;
};

export type QtQuoteKpi = {
  id?: string;
  version_id?: string;
  option_key?: string | null;
  name: string;
  class: string;
  value_text?: string | null;
  source?: string | null;
  assumption?: string | null;
};

export type QtQuoteVersion = {
  id?: string;
  n: number;
  state: string;
};

export type QtVersionDiff = {
  path: string;
  from?: unknown;
  to?: unknown;
  critical?: boolean;
};

export type QtOptionWrite = {
  option_key?: string;
  name?: string;
  recommended?: boolean;
  client_visible?: boolean;
  payable_vnd?: number;
};

export type QtOptionPatch = {
  recommended?: boolean;
  client_visible?: boolean;
  name?: string;
};

export function asQtOptions(body: unknown): QtQuoteOption[] {
  if (Array.isArray(body)) return body as QtQuoteOption[];
  if (body && typeof body === 'object' && Array.isArray((body as { options?: unknown }).options)) {
    return (body as { options: QtQuoteOption[] }).options;
  }
  return [];
}

export function asQtKpis(body: unknown): QtQuoteKpi[] {
  if (Array.isArray(body)) return body as QtQuoteKpi[];
  if (body && typeof body === 'object' && Array.isArray((body as { kpis?: unknown }).kpis)) {
    return (body as { kpis: QtQuoteKpi[] }).kpis;
  }
  return [];
}

export function asQtVersions(body: unknown): QtQuoteVersion[] {
  if (Array.isArray(body)) return body as QtQuoteVersion[];
  if (body && typeof body === 'object' && Array.isArray((body as { versions?: unknown }).versions)) {
    return (body as { versions: QtQuoteVersion[] }).versions;
  }
  return [];
}

export function asQtVersionDiffs(body: unknown): QtVersionDiff[] {
  if (Array.isArray(body)) return body as QtVersionDiff[];
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: QtVersionDiff[] }).items;
  }
  return [];
}

export function getQtOptions(token: string, vid: string) {
  return qtFetch<unknown>(token, `/quote-versions/${encodeURIComponent(vid)}/options`).then(
    (body) => ({ options: asQtOptions(body) }),
  );
}

export function postQtOption(token: string, vid: string, body: QtOptionWrite) {
  return qtFetch<{ option: QtQuoteOption; options: QtQuoteOption[] }>(
    token,
    `/quote-versions/${encodeURIComponent(vid)}/options`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function patchQtOption(token: string, vid: string, key: string, body: QtOptionPatch) {
  return qtFetch<{ option: QtQuoteOption; options: QtQuoteOption[] }>(
    token,
    `/quote-versions/${encodeURIComponent(vid)}/options/${encodeURIComponent(key)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function duplicateQtOption(token: string, vid: string, key: string) {
  return qtFetch<{ option: QtQuoteOption; options: QtQuoteOption[] }>(
    token,
    `/quote-versions/${encodeURIComponent(vid)}/options/${encodeURIComponent(key)}/duplicate`,
    { method: 'POST' },
  );
}

export function getQtKpis(token: string, vid: string) {
  return qtFetch<unknown>(token, `/quote-versions/${encodeURIComponent(vid)}/kpis`).then((body) => ({
    kpis: asQtKpis(body),
  }));
}

export function getQtVersions(token: string, id: number) {
  return qtFetch<unknown>(token, `/${id}/versions`).then((body) => ({ versions: asQtVersions(body) }));
}

export function getQtVersionDiff(token: string, id: number, fromN: number, toN: number) {
  return qtFetch<unknown>(token, `/${id}/versions/${fromN}/diff/${toN}`).then((body) => ({
    items: asQtVersionDiffs(body),
  }));
}

export function getQtQuoteCatalog(token: string, query?: { service?: string; tab?: string }) {
  const params = new URLSearchParams();
  if (query?.service) params.set('service', query.service);
  if (query?.tab) params.set('tab', query.tab);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return qtFetch<unknown>(token, `/quote-catalog${suffix}`).then(asQtCatalogItems);
}

export function getQtQuoteCatalogDoc(token: string, query?: { service?: string; tab?: string }) {
  const params = new URLSearchParams();
  if (query?.service) params.set('service', query.service);
  if (query?.tab) params.set('tab', query.tab);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return qtFetch<QtCatalogDoc>(token, `/quote-catalog${suffix}`);
}

export function snapshotQtCatalogPackage(token: string, packageKey: string, quoteDate?: string) {
  return qtFetch<{
    package_key: string;
    package_discount_bps: number;
    lines: Array<{ dv_code: string; catalog_snapshot_json: Record<string, unknown> }>;
  }>(token, `/quote-catalog/packages/${encodeURIComponent(packageKey)}/snapshot`, {
    method: 'POST',
    body: JSON.stringify(quoteDate ? { quote_date: quoteDate } : {}),
  });
}

export type QtConvertLifecycle = {
  line_id: number;
  lifecycle_id: number;
  dv_code: string;
};

export type QtConvertResult = {
  conversion_id: string;
  lifecycles: QtConvertLifecycle[];
  invoice_draft_ids: number[];
  optional_handoff: [];
};

export function convertQtVersion(
  token: string,
  id: number,
  vid: string,
  idempotencyKey: string,
) {
  return qtFetch<QtConvertResult>(
    token,
    `/${id}/versions/${encodeURIComponent(vid)}/convert`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
}

export const QT_SETTINGS_PATCH_FIELDS = [
  'validity_days',
  'vat_bps',
  'payment_template',
  'gm_floor_bps',
  'discount_auto_bps',
  'director_value_vnd',
  'payment_term_max_days',
  'share_expiry_days',
  'pdf_download',
  'otp_required',
  'view_tracking',
  'ai_enabled',
] as const;

export type QtSettingsPatchField = (typeof QT_SETTINGS_PATCH_FIELDS)[number];

export type QtSettings = {
  tenant_id?: string;
  quote_code_pattern: string;
  validity_days: number | null;
  vat_bps: number | null;
  currency_code?: string | null;
  timezone?: string | null;
  issuing_entity?: string | null;
  payment_template: string | null;
  gm_floor_bps: number | null;
  discount_auto_bps: number | null;
  director_value_vnd: number | null;
  payment_term_max_days: number | null;
  share_expiry_days: number | null;
  pdf_download: boolean;
  otp_required: boolean;
  view_tracking: boolean;
  ai_enabled: boolean;
  updated_at?: string | null;
  updated_by_staff_id?: number | null;
};

export type QtSettingsPatch = Partial<Record<QtSettingsPatchField, unknown>>;

export function buildQtSettingsPatch(input: Record<string, unknown>): QtSettingsPatch {
  const patch: QtSettingsPatch = {};
  for (const field of QT_SETTINGS_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      patch[field] = input[field];
    }
  }
  return patch;
}

export type QtApprovalChipId = 'mine' | 'done' | 'sla';

export type QtApprovalStep = {
  id: string;
  approval_id: string;
  seq: number;
  section: string;
  state: string;
  assignee_staff_id?: number | null;
  sla_hours?: number | null;
  acted_at?: string | null;
  comment?: string | null;
  delegate_from?: number | null;
  until?: string | null;
};

export type QtApprovalInboxItem = {
  step_id: string;
  approval_id: string;
  version_id: string;
  proposal_id: number;
  quote_code: string | null;
  version_n: number | null;
  client_name: string | null;
  trigger: string | null;
  step: string | null;
  sla: string | null;
  sla_breached: boolean;
  owner: { staff_id: number | null; name: string | null };
  state: string;
  assignee_staff_id: number | null;
  acted_at: string | null;
  comment: string | null;
  delegate_from: number | null;
  until: string | null;
  policy_badges: Array<{ code: string; tone: 'ok' | 'warn' }>;
  snapshot: {
    nsr_vnd: number | null;
    direct_cost_vnd: number | null;
    gp_vnd: number | null;
    gm_bps: number | null;
  };
  steps: QtApprovalStep[];
};

export type QtApprovalInboxResult = {
  items: QtApprovalInboxItem[];
  has_finance: boolean;
  can_approve: boolean;
};

export type QtApprovalActionInput = {
  action: 'approve' | 'return' | 'reject' | 'delegate' | string;
  comment?: string | null;
  delegate_staff_id?: number | null;
  until?: string | null;
};

export function getQtApprovals(
  token: string,
  query: { scope?: 'me' | 'team' | 'all'; chip?: QtApprovalChipId | string } = {},
) {
  const params = new URLSearchParams();
  if (query.scope && query.scope !== 'me') params.set('scope', query.scope);
  if (query.chip) params.set('chip', query.chip);
  const qs = params.toString();
  return qtFetch<QtApprovalInboxResult>(token, qs ? `/approvals?${qs}` : '/approvals');
}

export function postQtApprovalAction(token: string, sid: string, body: QtApprovalActionInput) {
  return qtFetch<{ step: QtApprovalStep; steps?: QtApprovalStep[] }>(
    token,
    `/quote-approval-steps/${encodeURIComponent(sid)}/actions`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function getQtSettings(token: string) {
  return qtFetch<QtSettings>(token, '/settings');
}

export function patchQtSettings(token: string, body: Record<string, unknown>) {
  return qtFetch<QtSettings>(token, '/settings', {
    method: 'PATCH',
    body: JSON.stringify(buildQtSettingsPatch(body)),
  });
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
  const isCrmRoot =
    /^(quote-versions|quote-approval-steps)\//.test(trimmed) ||
    path.startsWith('/quote-versions/') ||
    path.startsWith('/quote-approval-steps/');
  const url = isCrmRoot
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
