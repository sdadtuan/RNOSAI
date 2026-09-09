export type SkpiClassification =
  | 'COMMITTED_DELIVERABLE'
  | 'QUALITY_STANDARD'
  | 'OPTIMIZATION_TARGET'
  | 'PROJECTED_RESULT'
  | 'BUSINESS_OUTCOME'
  | 'INTERNAL_OPERATIONAL';

export type ServiceKpiTemplateStatus = 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export type ServiceKpiTemplateListItem = {
  id: string;
  dv_code: string;
  name: string;
  owner_team: string;
  status: ServiceKpiTemplateStatus;
  active_version_id: string | null;
  row_version: number;
  rule_count?: number;
  required_count?: number;
  client_visible_count?: number;
  updated_at?: string;
  current_version?: { id: string; rules: ServiceKpiTemplateRule[] } | null;
};

export type ServiceKpiTemplateRule = {
  id?: string;
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
};

export type CreateServiceKpiTemplateBody = {
  dv_code: string;
  name: string;
  owner_team?: string;
  rules: ServiceKpiTemplateRule[];
};

export type ServiceKpiPolicyPack = {
  id: string;
  industry: string;
  regulated: boolean;
  rules_json: unknown[];
  banned_phrases: string[];
};

export type ServiceKpiTemplatesResponse = {
  items: ServiceKpiTemplateListItem[];
  total: number;
  summary: { active: number; in_review: number };
};

export type CreateServiceKpiInstanceBody = {
  source_type: string;
  source_id: string;
  dictionary_id: string;
  dv_code?: string;
  classification?: SkpiClassification;
  scenario?: string;
  target_min?: number;
  target_max?: number;
  assumption_text?: string;
  disclaimer_text?: string;
  owner_name?: string;
  client_visible?: boolean;
};

export type ServiceKpiInstanceItem = {
  id: string;
  source_type: string;
  source_id: string;
  dv_code: string | null;
  dictionary_id: string;
  classification: SkpiClassification;
  status: string;
  client_visible: boolean;
  owner_name: string | null;
  target_min: number | null;
  target_max: number | null;
  scenario: string;
  assumption_state: string;
  row_version: number;
  readiness_level?: string;
  latest_actual?: number | null;
  variance_pct?: number | null;
};

export type ServiceKpiWarRoomData = {
  critical_overdue: number;
  assumptions_open: number;
  blocked_reports: number;
  quotes_score_gte_70: number;
  queue: Array<{ title: string; subtitle: string; href: string; badge: string }>;
  dv_health: Array<{ dv_code: string; kpi_health_pct: number; gm_pct: number | null }>;
};

export type IngestActualBody = {
  period_start: string;
  period_end: string;
  value?: number | null;
  source_ref?: string;
  quality_status?: string;
  collection_method?: string;
  note?: string;
  duplicate_action?: 'skip' | 'merge' | 'correction';
};

export type ServiceKpiMeasurementPlan = {
  id?: string;
  instance_id: string;
  owner_name?: string;
  cadence?: string;
  timezone?: string;
  data_source?: string;
  field_mapping?: string;
  freshness_sla_hours?: number;
  qa_status?: string;
};

export type ServiceKpiActualRecord = {
  id: string;
  instance_id: string;
  period_start: string;
  period_end: string;
  value: number | null;
  quality_status: string;
  source_ref?: string;
  note?: string;
};

export type ServiceKpiReconcileRow = {
  instance_id: string;
  dictionary_id: string;
  classification: string;
  quoted: unknown;
  delivered: unknown;
  reported: unknown;
  quality_status: string;
  behavior: string;
};
