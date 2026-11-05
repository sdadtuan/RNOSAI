import { API_BASE, ApiError, parseJson } from './api';
import type { DeliveryCapability, DeliveryHealth, DeliveryProjectStatus, IngestStatus } from './delivery-projects.util';

export type DeliveryProjectRow = {
  id: string;
  tenant_id: string;
  code: string | null;
  name: string;
  capabilities: DeliveryCapability[];
  b2b_project_id: string | null;
  status: DeliveryProjectStatus;
  customer_id: number | null;
  project_type: string;
  priority: string;
  pm_staff_id: number | null;
  am_staff_id: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string;
  health_status: DeliveryHealth;
  health_components_json: Record<string, unknown>;
  row_version: number;
  ingest_status?: IngestStatus | null;
  ingest_code?: string | null;
  service_codes?: string[];
  contract_budget?: string | null;
  internal_cost_budget?: string | null;
  client_media_budget?: string | null;
  forecast_cost?: string | null;
  gross_margin_pct?: string | null;
};

export type CreateDeliveryBody = {
  name: string;
  capabilities: DeliveryCapability[];
  ingest_code?: string;
  customer_id?: number | null;
  project_type?: string;
  priority?: string;
  pm_staff_id?: number | null;
  am_staff_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  b2b?: {
    code: string;
    name?: string;
    status?: IngestStatus;
    ai_call_enabled?: boolean;
    manual_ingest_enabled?: boolean;
  };
};

export type PatchDeliveryBody = {
  name?: string;
  status?: DeliveryProjectStatus;
  customer_id?: number | null;
  project_type?: string;
  priority?: string;
  pm_staff_id?: number | null;
  am_staff_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
};

export type DeliveryDeliverableInput = {
  service_code: string;
  name: string;
  quantity?: string;
  acceptance?: string;
  owner_staff_id?: number | null;
  sort_order?: number;
};

export type DeliveryMilestoneInput = {
  code: string;
  name: string;
  start_date?: string | null;
  due_date?: string | null;
  owner_staff_id?: number | null;
  status?: string;
  acceptance?: string;
  weight?: string | null;
};

export type SaveWizardBody = {
  step: number;
  services?: string[];
  deliverables?: DeliveryDeliverableInput[];
  milestones?: DeliveryMilestoneInput[];
  deps?: Array<{ from: string; to: string }>;
  state_json?: Record<string, unknown>;
  contract_budget?: string | null;
  contingency_amount?: string | null;
  finance_policy_json?: Record<string, unknown>;
};

export type DeliveryProjectKpiRow = {
  id: string;
  project_id: string;
  dictionary_id: string;
  dictionary_code: string;
  dictionary_name: string;
  kpi_version_id: string | null;
  target_id: string | null;
  cycle: string;
  owner_staff_id: number | null;
  baseline: string | null;
  warning_value: string | null;
  critical_value: string | null;
  inherit_alert: boolean;
};

export type AttachProjectKpisBody = {
  dictionary_ids: string[];
  create_draft_targets?: boolean;
  inherit_alerts?: boolean;
};

export type SubmitDeliveryBody = {
  skip_kpi_reason?: string;
  checklist?: Record<string, boolean>;
  cadence_json?: Record<string, unknown>;
};

export type DeliveryRiskRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  owner_staff_id: number | null;
  sla_due: string | null;
  status: 'open' | 'mitigated' | 'closed';
  note: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryChangeRequestRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  kind: 'scope' | 'budget';
  payload_json: Record<string, unknown>;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  baseline_version: number;
  note: string | null;
  created_by_staff_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryQualitySnapshotRow = {
  id: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  period: string;
  ontime_milestone_pct: string | null;
  client_approval_sla: string | null;
  rework_pct: string | null;
  score: string | null;
  computed_at: string;
};

export type CapacityTeamRow = {
  team: string;
  weeks: Array<{ week: string; pct: number; overloaded: boolean }>;
  peak_pct: number;
};

export type CreateDeliveryRiskBody = {
  severity: DeliveryRiskRow['severity'];
  title: string;
  owner_staff_id?: number | null;
  sla_due?: string | null;
  note?: string | null;
};

export type PatchDeliveryRiskBody = Partial<CreateDeliveryRiskBody> & {
  status?: DeliveryRiskRow['status'];
};

export type CreateDeliveryChangeRequestBody = {
  kind: DeliveryChangeRequestRow['kind'];
  payload_json?: Record<string, unknown>;
  note?: string | null;
  submit?: boolean;
};

export const DELIVERY_SERVICE_CATALOG = [
  { code: 'performance_marketing', name: 'Performance Marketing' },
  { code: 'landing_cro', name: 'Landing Page & CRO' },
  { code: 'crm_automation', name: 'CRM Automation' },
  { code: 'creative_production', name: 'Creative Production' },
  { code: 'seo_content', name: 'SEO & Content' },
  { code: 'website', name: 'Website Development' },
  { code: 'branding', name: 'Branding' },
  { code: 'training', name: 'Training & Consulting' },
] as const;

export function parseDeliveryProjectList(body: unknown): DeliveryProjectRow[] {
  const items = Array.isArray(body) ? body : (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.map((row) => normalizeDeliveryRow(row as Record<string, unknown>));
}

export function normalizeDeliveryRow(row: Record<string, unknown>): DeliveryProjectRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id ?? 'PTT'),
    code: row.code != null ? String(row.code) : null,
    name: String(row.name ?? ''),
    capabilities: Array.isArray(row.capabilities) ? (row.capabilities as DeliveryCapability[]) : [],
    b2b_project_id: row.b2b_project_id != null ? String(row.b2b_project_id) : null,
    status: String(row.status ?? 'draft') as DeliveryProjectStatus,
    customer_id: row.customer_id != null ? Number(row.customer_id) : null,
    project_type: String(row.project_type ?? ''),
    priority: String(row.priority ?? 'normal'),
    pm_staff_id: row.pm_staff_id != null ? Number(row.pm_staff_id) : null,
    am_staff_id: row.am_staff_id != null ? Number(row.am_staff_id) : null,
    start_date: row.start_date != null ? String(row.start_date) : null,
    end_date: row.end_date != null ? String(row.end_date) : null,
    description: String(row.description ?? ''),
    health_status: String(row.health_status ?? 'no_data') as DeliveryHealth,
    health_components_json:
      row.health_components_json && typeof row.health_components_json === 'object'
        ? (row.health_components_json as Record<string, unknown>)
        : {},
    row_version: Number(row.row_version ?? 1),
    ingest_status: row.ingest_status != null ? (String(row.ingest_status) as IngestStatus) : null,
    ingest_code: row.ingest_code != null ? String(row.ingest_code) : null,
    service_codes: Array.isArray(row.service_codes) ? row.service_codes.map(String) : undefined,
    contract_budget: row.contract_budget != null ? String(row.contract_budget) : null,
    internal_cost_budget: row.internal_cost_budget != null ? String(row.internal_cost_budget) : null,
    client_media_budget: row.client_media_budget != null ? String(row.client_media_budget) : null,
    forecast_cost: row.forecast_cost != null ? String(row.forecast_cost) : null,
    gross_margin_pct: row.gross_margin_pct != null ? String(row.gross_margin_pct) : null,
  };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function deliveryFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(body.error ?? body.message ?? 'Delivery projects request failed', res.status);
  }
  return body;
}

export async function fetchDeliveryProjects(
  token: string,
  query: { capability?: string; q?: string; status?: string } = {},
): Promise<{ items: DeliveryProjectRow[] }> {
  const params = new URLSearchParams();
  if (query.capability) params.set('capability', query.capability);
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const body = await deliveryFetch<unknown>(token, `/api/crm/delivery-projects${qs}`);
  return { items: parseDeliveryProjectList(body) };
}

export async function createDeliveryProject(token: string, body: CreateDeliveryBody): Promise<DeliveryProjectRow> {
  const res = await deliveryFetch<Record<string, unknown>>(token, '/api/crm/delivery-projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalizeDeliveryRow(res);
}

export async function fetchDeliveryProject(token: string, id: string): Promise<DeliveryProjectRow> {
  const res = await deliveryFetch<Record<string, unknown>>(token, `/api/crm/delivery-projects/${encodeURIComponent(id)}`);
  return normalizeDeliveryRow(res);
}

export async function patchDeliveryProject(
  token: string,
  id: string,
  body: PatchDeliveryBody,
): Promise<DeliveryProjectRow> {
  const res = await deliveryFetch<Record<string, unknown>>(token, `/api/crm/delivery-projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return normalizeDeliveryRow(res);
}

export async function saveDeliveryWizard(
  token: string,
  id: string,
  body: SaveWizardBody,
): Promise<DeliveryProjectRow> {
  const res = await deliveryFetch<Record<string, unknown>>(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(id)}/wizard`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
  return normalizeDeliveryRow(res);
}

export async function validateDeliveryDeps(
  token: string,
  id: string,
  deps: Array<{ from: string; to: string }>,
): Promise<{ ok: boolean; circular?: boolean }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(id)}/milestones/validate-deps`, {
    method: 'POST',
    body: JSON.stringify({ deps }),
  });
}

export async function backfillDeliveryProjects(token: string): Promise<{ inserted: number }> {
  return deliveryFetch(token, '/api/crm/delivery-projects/backfill', { method: 'POST' });
}

export type BudgetItemBody = {
  name: string;
  service_code?: string | null;
  kind: 'labor' | 'production' | 'software' | 'media' | 'other';
  media_borne?: 'agency_borne' | 'client_borne' | null;
  cost_center?: string | null;
  owner_staff_id?: number | null;
  approved_budget: string;
  forecast: string;
  allocation_method?: 'even' | 'milestone' | 'manual';
  description?: string | null;
  manual_allocs?: Array<{ amount: string; period?: string; milestone_id?: string }>;
};

export type BudgetItemRow = {
  id: string;
  project_id: string;
  name: string;
  service_code: string | null;
  kind: string;
  media_borne: string | null;
  cost_center: string | null;
  owner_staff_id: number | null;
  approved_budget: string;
  forecast: string;
  actual: string;
  allocation_method: string;
  description: string | null;
  row_version: number;
};

export type BudgetImpactPreview = {
  internal_before: string;
  internal_after: string;
  contract: string | null;
  margin_before: string | null;
  margin_after: string | null;
  allocated_pct: string;
  policy_critical: boolean;
  forecast_over_budget: boolean;
};

export type ResourceBody = {
  staff_id: number;
  role_name?: string | null;
  team_name?: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string;
  estimated_cost?: string | null;
  overload_reason?: string | null;
};

export type ResourceRow = {
  id: string;
  project_id: string;
  staff_id: number;
  role_name: string | null;
  team_name: string | null;
  allocation_pct: string;
  start_date: string;
  end_date: string;
  estimated_cost: string | null;
  overload_reason: string | null;
  row_version: number;
};

export async function fetchBudgetItems(
  token: string,
  projectId: string,
): Promise<{ items: BudgetItemRow[]; header: Record<string, unknown> | null }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/budget-items`);
}

export async function previewBudgetImpact(
  token: string,
  projectId: string,
  body: BudgetItemBody,
): Promise<BudgetImpactPreview> {
  return deliveryFetch(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/budget-items/preview-impact`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function createBudgetItem(
  token: string,
  projectId: string,
  body: BudgetItemBody,
): Promise<BudgetItemRow> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/budget-items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResources(token: string, projectId: string): Promise<{ items: ResourceRow[] }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/resources`);
}

export async function createResource(token: string, projectId: string, body: ResourceBody): Promise<ResourceRow> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/resources`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitDeliveryProject(
  token: string,
  projectId: string,
  body: {
    skip_kpi_reason?: string;
    checklist?: Record<string, boolean>;
    cadence_json?: Record<string, unknown>;
  },
): Promise<DeliveryProjectRow & { kpi_count?: number; needs_finance?: boolean }> {
  const res = await deliveryFetch<Record<string, unknown>>(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/submit`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return normalizeDeliveryRow(res);
}

export async function fetchDeliveryProjectKpis(
  token: string,
  id: string,
): Promise<{ items: DeliveryProjectKpiRow[] }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(id)}/kpis`);
}

export async function attachDeliveryProjectKpis(
  token: string,
  id: string,
  body: AttachProjectKpisBody,
): Promise<{ items: DeliveryProjectKpiRow[]; count: number }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(id)}/kpis`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchDeliveryRisks(
  token: string,
  projectId?: string,
): Promise<{ items: DeliveryRiskRow[] }> {
  const path = projectId
    ? `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/risks`
    : '/api/crm/delivery-projects/risks';
  return deliveryFetch(token, path);
}

export async function createDeliveryRisk(
  token: string,
  projectId: string,
  body: CreateDeliveryRiskBody,
): Promise<DeliveryRiskRow> {
  return deliveryFetch(token, `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/risks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchDeliveryRisk(
  token: string,
  projectId: string,
  riskId: string,
  body: PatchDeliveryRiskBody,
): Promise<DeliveryRiskRow> {
  return deliveryFetch(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/risks/${encodeURIComponent(riskId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function fetchDeliveryChangeRequests(
  token: string,
  projectId: string,
  status?: string,
): Promise<{ items: DeliveryChangeRequestRow[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return deliveryFetch(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/change-requests${qs}`,
  );
}

export async function createDeliveryChangeRequest(
  token: string,
  projectId: string,
  body: CreateDeliveryChangeRequestBody,
): Promise<DeliveryChangeRequestRow> {
  return deliveryFetch(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/change-requests`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function fetchDeliveryCapacity(
  token: string,
  weeks = 4,
): Promise<{ range: { start: string; end: string }; teams: CapacityTeamRow[] }> {
  return deliveryFetch(token, `/api/crm/delivery-projects/capacity?weeks=${weeks}`);
}

export async function fetchDeliveryQuality(
  token: string,
  period?: string,
): Promise<{ items: DeliveryQualitySnapshotRow[] }> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return deliveryFetch(token, `/api/crm/delivery-projects/quality${qs}`);
}

export async function computeDeliveryQuality(
  token: string,
  projectId: string,
  period?: string,
): Promise<DeliveryQualitySnapshotRow> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return deliveryFetch(
    token,
    `/api/crm/delivery-projects/${encodeURIComponent(projectId)}/quality/compute${qs}`,
    { method: 'POST' },
  );
}
