import type { DeliveryCapability, DeliveryHealth, DeliveryProjectStatus, IngestStatus } from './delivery-projects.util';

export type { DeliveryCapability, DeliveryHealth, DeliveryProjectStatus, IngestStatus };

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
  contract_budget?: string | null;
  internal_cost_budget?: string | null;
  client_media_budget?: string | null;
  forecast_cost?: string | null;
  gross_margin_pct?: string | null;
};

export type DeliveryListFilters = {
  capability?: 'all' | 'lead_ingest' | 'delivery' | 'both';
  q?: string;
  status?: string;
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
