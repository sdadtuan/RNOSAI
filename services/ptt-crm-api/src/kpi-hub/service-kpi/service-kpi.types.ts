import type { SkpiClassification } from './service-kpi-classification';

export const SERVICE_KPI_TENANT_ID = 'PTT';

export type ServiceKpiTemplateStatus = 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export type ServiceKpiTemplateRuleRow = {
  id: string;
  dictionary_id: string;
  classification: SkpiClassification;
  is_required: boolean;
  client_visible: boolean;
  display_order: number;
  target_min: number | null;
  target_max: number | null;
  target_unit: string | null;
  scenario: string;
  assumption_template: string;
  disclaimer_template: string;
  owner_role: string;
  cadence: string;
};

export type ServiceKpiTemplateVersionRow = {
  id: string;
  template_id: string;
  version_no: number;
  status: string;
  rules: ServiceKpiTemplateRuleRow[];
};

export type ServiceKpiTemplateRow = {
  id: string;
  dv_code: string;
  name: string;
  owner_team: string;
  status: ServiceKpiTemplateStatus;
  active_version_id: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
  current_version?: ServiceKpiTemplateVersionRow | null;
  rule_count?: number;
  required_count?: number;
  client_visible_count?: number;
};

export type CreateTemplateBody = {
  dv_code: string;
  name: string;
  owner_team?: string;
  rules: Array<{
    dictionary_id: string;
    classification: SkpiClassification;
    is_required?: boolean;
    client_visible?: boolean;
    target_min?: number;
    target_max?: number;
    assumption_template?: string;
    disclaimer_template?: string;
    owner_role?: string;
    cadence?: string;
  }>;
};

export type ServiceKpiPolicyPackRow = {
  id: string;
  industry: string;
  regulated: boolean;
  rules_json: unknown[];
  banned_phrases: string[];
};

export type ServiceKpiInstanceStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'TRACKING'
  | 'AT_RISK'
  | 'ACHIEVED'
  | 'MISSED'
  | 'WAIVED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export type ServiceKpiInstanceRow = {
  id: string;
  source_type: string;
  source_id: string;
  dv_code: string | null;
  dictionary_id: string;
  template_version_id: string | null;
  classification: SkpiClassification;
  status: ServiceKpiInstanceStatus;
  client_visible: boolean;
  owner_name: string | null;
  target_min: number | null;
  target_max: number | null;
  scenario: string;
  assumption_text: string;
  assumption_state: string;
  disclaimer_text: string;
  row_version: number;
  created_at: string;
  updated_at: string;
  readiness_level?: string;
  latest_actual?: number | null;
  variance_pct?: number | null;
};

export type ServiceKpiMeasurementPlanRow = {
  id: string;
  instance_id: string;
  owner_name: string;
  cadence: string;
  timezone: string;
  data_source: string;
  field_mapping: string;
  freshness_sla_hours: number;
  qa_status: string;
};

export type ServiceKpiActualRow = {
  id: string;
  instance_id: string;
  period_start: string;
  period_end: string;
  value: number | null;
  unit: string | null;
  quality_status: string;
  collection_method: string;
  source_ref: string;
  note: string;
  superseded_by: string | null;
};

export type ServiceKpiSnapshotRow = {
  id: string;
  instance_id: string;
  quote_version_id: string;
  ledger: 'quoted' | 'delivered' | 'reported';
  payload_json: Record<string, unknown>;
  created_at: string;
};

export type CreateInstanceBody = {
  source_type: string;
  source_id: string;
  dictionary_id: string;
  dv_code?: string;
  template_version_id?: string | null;
  classification?: SkpiClassification;
  scenario?: string;
  target_min?: number;
  target_max?: number;
  assumption_text?: string;
  disclaimer_text?: string;
  owner_name?: string;
  client_visible?: boolean;
};

export type PatchInstanceBody = {
  owner_name?: string;
  target_min?: number;
  target_max?: number;
  scenario?: string;
  assumption_text?: string;
  assumption_state?: 'pending' | 'confirmed' | 'not_met';
  disclaimer_text?: string;
  status?: ServiceKpiInstanceStatus;
  evidence?: string;
};

export type IngestActualBody = {
  period_start: string;
  period_end: string;
  value?: number | null;
  unit?: string;
  source_ref?: string;
  quality_status?: string;
  collection_method?: string;
  note?: string;
  duplicate_action?: 'skip' | 'merge' | 'correction';
};

export type ServiceKpiBenchmarkRow = {
  id: string;
  dv_code: string;
  dictionary_id: string;
  industry: string;
  channel: string;
  budget_band: string;
  p50: number | null;
  p80: number | null;
  sample_n: number;
  updated_at: string;
};
