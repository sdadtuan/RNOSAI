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

export type ServiceKpiWarRoomQueueItem = {
  title: string;
  subtitle: string;
  href: string;
  badge: string;
  action_label?: string;
  action_href?: string;
};

export type ServiceKpiOverview = {
  templates_active: number;
  instances_tracking: number;
  instances_tracking_pct: number;
  readiness_warning: number;
  readiness_blocking: number;
  at_risk: number;
  at_risk_critical: number;
};

export type ServiceKpiWarRoomData = {
  critical_overdue: number;
  assumptions_open: number;
  blocked_reports: number;
  quotes_score_gte_70: number;
  queue: ServiceKpiWarRoomQueueItem[];
  dv_health: Array<{ dv_code: string; kpi_health_pct: number; gm_pct: number | null }>;
};

export type ServiceKpiQuoteContractScore = {
  version_id: string;
  proposal_id: number;
  quote_code: string | null;
  client_name: string | null;
  gm_bps: number | null;
  score: number;
  blocked: boolean;
};

export type ServiceKpiReconcileSource = {
  source_type: string;
  source_id: string;
  instance_count: number;
};

export type ServiceKpiContractGateRow = {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'critical' | 'default';
};

export type ServiceKpiContractKpiSummary = {
  dictionary_id: string;
  classification: string;
  target_min: number | null;
  target_max: number | null;
  assumption_state: string;
  assumption_text: string | null;
  disclaimer_text: string | null;
  client_visible: boolean;
  aggressiveness_pct: number | null;
};

export type ServiceKpiContractScoreLive = {
  score: number;
  parts: Record<string, number>;
  blockSubmit: boolean;
  requiredReviewers: string[];
  gm_bps?: number | null;
  gm_floor_bps?: number;
  classification_risk?: number;
  target_aggressiveness?: number;
  assumption_open?: number;
  data_readiness_gap?: number;
  margin_pressure?: number;
  industry?: string | null;
  trigger_summary?: string;
  trigger_policy?: string;
  classification_hint?: string;
  gate_rows?: ServiceKpiContractGateRow[];
  kpis?: ServiceKpiContractKpiSummary[];
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
  collection_method?: string;
  note?: string;
  created_at?: string | null;
};

export type ServiceKpiTrackingActualItem = {
  id: string;
  instance_id: string;
  dictionary_id: string;
  source_id: string;
  dv_code: string | null;
  period_start: string;
  period_end: string;
  value: number | null;
  quality_status: string;
  collection_method: string;
  source_ref: string;
  created_at: string | null;
  instance_status: string;
};

export type ServiceKpiTrackingSummary = {
  today_total: number;
  verified_pct: number;
  api_connector_total: number;
  api_connector_hint: string;
  manual_import_total: number;
  pending_verify: number;
  data_issues: number;
  stale_count: number;
  duplicate_count: number;
};

export type ServiceKpiTrackingHighlight = {
  instance_id: string;
  dictionary_id: string;
  source_id: string;
  status: string;
  target_min: number | null;
  target_max: number | null;
  latest_value: number | null;
  variance_pct: number | null;
  actuals: ServiceKpiActualRecord[];
};

export type ServiceKpiTrackingDashboard = {
  summary: ServiceKpiTrackingSummary;
  recent: ServiceKpiTrackingActualItem[];
  highlight: ServiceKpiTrackingHighlight | null;
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
  material_variance?: boolean;
  variance_pct?: number | null;
};

export type ServiceKpiChangeOrderPreview = {
  source_id: string;
  quote_context: {
    proposal_id: number;
    version_id: string;
    quote_code: string | null;
  } | null;
  rows: ServiceKpiReconcileRow[];
  material_count: number;
};

export type ServiceKpiChangeOrderResult = {
  change_order_id: string;
  source_id: string;
  proposal_id: number;
  from_version_id: string;
  new_version_id: string;
  version_n: number;
  material_count: number;
  delivered_snapshots: number;
  builder_href: string;
};

export type ImportActualRow = {
  instance_id?: string;
  dictionary_id?: string;
  source_id?: string;
  period_start: string;
  period_end: string;
  value?: number | null;
  quality_status?: string;
  source_ref?: string;
  duplicate_action?: 'skip' | 'merge' | 'correction';
};

export type ImportActualResult = {
  imported: number;
  skipped: number;
  total: number;
  errors: Array<{ row: number; error: string }>;
};

export type ServiceKpiContractRiskItem = {
  instance_id: string;
  source_type: string;
  source_id: string;
  dictionary_id: string;
  dv_code: string | null;
  classification: SkpiClassification;
  status: string;
  assumption_state: string;
  score: number;
  block_submit: boolean;
  required_reviewers: string[];
  parts: Record<string, number>;
  target_min: number | null;
  target_max: number | null;
  latest_actual: number | null;
  variance_pct: number | null;
};

export type ServiceKpiContractRiskResponse =
  | { items: ServiceKpiContractRiskItem[] }
  | {
      score: number;
      parts: Record<string, number>;
      blockSubmit: boolean;
      requiredReviewers: string[];
    };
