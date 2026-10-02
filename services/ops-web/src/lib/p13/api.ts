import { API_BASE } from '@/lib/api';

async function p13Fetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    const error = new Error(body.message || body.error || 'request_failed') as Error & {
      status: number;
      code?: string;
      body?: T & { missing?: string[] };
    };
    error.status = res.status;
    error.code = body.error;
    error.body = body;
    throw error;
  }
  return body;
}

export type P13ServiceRow = {
  code: string;
  name: string;
  group_code: string;
  group_name: string;
  item_count: number;
  catalog_version: string | null;
  billing_model: string | null;
};

export type P13GroupRow = { code: string; name: string; sort_order: number; service_count: number; item_count: number };

export type P13Item = {
  code: string;
  phase_code: string;
  task: string;
  subtask: string | null;
  standard: string | null;
  raci: { R?: string[]; A?: string[]; C?: string[]; I?: string[] };
  main_role_code: string;
  tool: string | null;
  deliverable: string | null;
  approval_gate: boolean;
  gate_approver: string | null;
  min_level: string;
  est_hours: string;
  est_hours_is_assumption: boolean;
  est_hours_source: string;
  unit: string;
  default_qty: string;
  billable: boolean;
  client_only: boolean;
};

export type P13ServiceDetail = {
  code: string;
  name: string;
  group_name: string;
  objective: string | null;
  billing_model: string | null;
  catalog_version: string | null;
  pricing_active: boolean;
  package_hours: Record<string, { hours: string; price_vnd: null }>;
  phases: Array<{ code: string; name: string; seq: number }>;
  items: P13Item[];
  inputs: Array<{ code: string; type: string | null; name: string; format_or_permission: string | null }>;
  deliverables: Array<{ code: string; name: string; format: string | null; acceptance_criteria: string | null }>;
  kpis: Array<{ code: string; name: string; type: string | null; formula: string | null }>;
  risks: Array<{ code: string; risk: string; likelihood: string | null; impact: string | null; mitigation: string | null }>;
  scope: Array<{ feature: string; basic_text: string | null; standard_text: string | null; advanced_text: string | null }>;
};

export function fetchP13Groups(token: string) {
  return p13Fetch<P13GroupRow[]>(token, '/api/crm/p13/groups');
}
export function fetchP13Services(token: string) {
  return p13Fetch<P13ServiceRow[]>(token, '/api/crm/p13/services');
}
export function fetchP13Service(token: string, code: string) {
  return p13Fetch<P13ServiceDetail>(token, `/api/crm/p13/services/${code}`);
}
export function patchP13Item(token: string, code: string, body: Record<string, unknown>) {
  return p13Fetch<P13Item>(token, `/api/crm/p13/service-items/${code}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function confirmP13Hours(token: string, code: string) {
  return p13Fetch<{ updated: number }>(token, `/api/crm/p13/services/${code}/confirm-hours`, { method: 'POST', body: '{}' });
}
export function importP13Seed(token: string, seed: unknown, dryRun: boolean) {
  return p13Fetch<Record<string, unknown>>(token, '/api/crm/p13/catalog-import', {
    method: 'POST',
    body: JSON.stringify({ seed, dry_run: dryRun, file_name: 'p13-seed-v2.json' }),
  });
}
export function fetchP13Holidays(token: string) {
  return p13Fetch<{ holidays: Array<{ holiday_date: string; name: string }>; warning: string | null }>(token, '/api/crm/p13/holidays');
}
export function saveP13Holiday(token: string, date: string, name: string) {
  return p13Fetch(token, '/api/crm/p13/holidays', { method: 'POST', body: JSON.stringify({ date, name }) });
}
export function deleteP13Holiday(token: string, date: string) {
  return p13Fetch(token, `/api/crm/p13/holidays/${date}`, { method: 'DELETE' });
}

export type P13PricingVersion = {
  id: string;
  code: string;
  status: 'draft' | 'active' | 'retired';
  effective_from: string | null;
  effective_to: string | null;
  updated_at: string;
  notes: string | null;
  inversion_ack: boolean;
  inversion_ack_note: string | null;
};

export type P13PricingRole = {
  role_code: string;
  name: string;
  productive_hours: string | null;
  monthly_salary?: string | null;
  insurance_pct?: string | null;
  monthly_benefits?: string | null;
  hourly_rate?: string | null;
  rate_display?: string | null;
};

export type P13PricingSettings = {
  overhead_pct: string | null;
  margin_pct: string | null;
  vat_pct: string | null;
  rounding_unit: string | null;
  discount_basic_pct: string | null;
  discount_standard_pct: string | null;
  discount_advanced_pct: string | null;
  ads_fee_pct: string | null;
  ads_fee_min_monthly: string | null;
  booking_fee_pct: string | null;
  discount_approval_threshold_pct: string | null;
  min_margin_after_discount_pct: string | null;
};

export type P13MatrixCell = {
  service_code: string;
  level: 'basic' | 'standard' | 'advanced';
  hours: string;
  price_vnd: string | null;
  client_only: number;
};

export function fetchP13PricingVersions(token: string) {
  return p13Fetch<{ versions: P13PricingVersion[] }>(token, '/api/crm/p13/pricing/versions');
}
export function fetchP13PricingVersion(token: string, id: string) {
  return p13Fetch<P13PricingVersion & { roles: P13PricingRole[]; settings: P13PricingSettings }>(token, `/api/crm/p13/pricing/versions/${id}`);
}
export function createP13PricingDraft(token: string) {
  return p13Fetch<P13PricingVersion>(token, '/api/crm/p13/pricing/versions', { method: 'POST', body: '{}' });
}
export function patchP13Pricing(token: string, id: string, body: Record<string, unknown>) {
  return p13Fetch(token, `/api/crm/p13/pricing/versions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function cloneP13Pricing(token: string, id: string) {
  return p13Fetch<P13PricingVersion>(token, `/api/crm/p13/pricing/versions/${id}/clone`, { method: 'POST', body: '{}' });
}
export function activateP13Pricing(token: string, id: string, body: { effective_from?: string; inversion_ack?: boolean; inversion_ack_note?: string }) {
  return p13Fetch(token, `/api/crm/p13/pricing/versions/${id}/activate`, { method: 'POST', body: JSON.stringify(body) });
}
export function fetchP13PricingMatrix(token: string, versionId: string) {
  return p13Fetch<{ matrix: P13MatrixCell[]; inversions: string[]; scope_identical: string[]; missing: string[]; warnings: string[] }>(
    token,
    `/api/crm/p13/pricing/matrix?version_id=${encodeURIComponent(versionId)}`,
  );
}
