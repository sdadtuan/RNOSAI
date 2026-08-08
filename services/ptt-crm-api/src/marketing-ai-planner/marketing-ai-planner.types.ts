export type MktAiJobType =
  | 'brief_summarize'
  | 'strategy_generate'
  | 'campaign_generate'
  | 'content_generate'
  | 'quality_score'
  | 'apply_to_tmmt'
  | 'budget_simulate'
  | 'optimize'
  | 'multi_agent';

export type MktAiJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface MktAiBrief {
  brand_name?: string;
  industry?: string;
  service_slug?: string;
  objective?: 'lead' | 'awareness' | 'sales' | 'retention' | string;
  budget_monthly_vnd?: number;
  geo_markets?: string[];
  competitors?: string[];
  challenges?: string;
  usp?: string;
  website_url?: string;
  timeline_start?: string;
  timeline_end?: string;
  notes?: string;
  /** When true (default), strategy generation uses indexed Brand KB chunks. */
  use_rag?: boolean;
}

export type MktAiDocumentStatus =
  | 'pending'
  | 'indexing'
  | 'indexed'
  | 'failed'
  | 'archived';

export interface MktAiDocumentRow {
  id: number;
  lifecycle_id: number;
  filename: string;
  mime_type: string;
  file_size_bytes: number | null;
  status: MktAiDocumentStatus;
  chunk_count: number;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface MktAiRagChunkHit {
  chunk_id: number;
  document_id: number;
  chunk_index: number;
  page_no: number | null;
  filename: string;
  title: string;
  body: string;
  rank: number;
}

export interface MktAiCitation {
  chunk_id: number;
  document_id: number;
  filename: string;
  page_no: number | null;
  section_key?: string;
  excerpt?: string;
}

export interface MktAiBudgetScenarioRow {
  id: number;
  lifecycle_id: number;
  job_id: number | null;
  name: string;
  slug: string;
  budget_monthly_vnd: number;
  channel_mix_json: Record<string, number>;
  cpl_estimates_json: Record<string, number>;
  assumptions_json: Record<string, unknown>;
  is_selected: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MktAiBriefValidation {
  ok: boolean;
  missing: string[];
  messages: string[];
}

export interface MktAiDraft {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, unknown>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
}

export interface MktAiCampaignDraft {
  name: string;
  objective: string;
  channel_mix: string[];
  budget_pct: number;
  timeline_weeks?: string;
  milestones?: string[];
  kpis?: string[];
}

export interface MktAiJobRow {
  id: number;
  lifecycle_id: number;
  job_type: MktAiJobType;
  status: MktAiJobStatus;
  prompt_version: string;
  model_name: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_message: string | null;
  latency_ms: number | null;
  actor_email: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface MktAiPlannerContext {
  lifecycle_id: number;
  stage: string;
  service_slug: string;
  enabled: boolean;
  brief: MktAiBrief | null;
  brief_validation: MktAiBriefValidation;
  prefill_sources: string[];
  jobs: MktAiJobRow[];
  draft: MktAiDraft;
  tmmt_validation: { ok: boolean; messages: string[]; filled_count?: number };
  quality_score?: {
    score: number;
    criteria: Record<string, boolean>;
    can_apply: boolean;
    can_export: boolean;
    can_export_docx_only?: boolean;
  };
  flags: { rag_enabled: boolean; approval_required: boolean; stub_mode: boolean };
  documents?: MktAiDocumentRow[];
  rag?: { use_rag: boolean; indexed_count: number };
  budget_scenarios?: MktAiBudgetScenarioRow[];
  approval?: MktAiApprovalContext;
  comments?: MktAiCommentRow[];
  plan_versions?: MktAiPlanVersionSummary[];
}

export interface MktAiPlanVersionSummary {
  id: number;
  version_no: number;
  label: string;
  status: MktAiPlanVersionStatus;
  created_by: string;
  created_at: string;
  quality_score: number | null;
  campaign_count: number;
}

export type MktAiApprovalStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'cancelled';

export type MktAiPlanVersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'applied'
  | 'archived';

export interface MktAiPlanVersionRow {
  id: number;
  lifecycle_id: number;
  version_no: number;
  label: string;
  status: MktAiPlanVersionStatus;
  brief_json: MktAiBrief;
  strategy_framework_json: Record<string, string>;
  target_market_prof_json: Record<string, string>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
  marketing_plan_id: number | null;
  applied_at: string | null;
  created_by: string;
  created_at: string;
}

export interface MktAiApprovalRow {
  id: number;
  lifecycle_id: number;
  plan_version_id: number;
  status: MktAiApprovalStatus;
  requested_by: string;
  approver_email: string | null;
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  plan_version?: MktAiPlanVersionRow;
}

export interface MktAiCommentRow {
  id: number;
  lifecycle_id: number;
  plan_version_id: number | null;
  approval_id: number | null;
  author_email: string;
  body: string;
  anchor_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MktAiApprovalContext {
  required: boolean;
  latest: MktAiApprovalRow | null;
  can_export: boolean;
  can_submit: boolean;
}

export interface MktAiDashboardTrendWeek {
  week_label: string;
  week_start: string;
  spend_vnd: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
  roas_stub: boolean;
}

export interface MktAiDashboardPayload {
  ok: boolean;
  lifecycle_id: number;
  stage: string;
  agency_client_id: string | null;
  linked: boolean;
  period: { from: string; to: string; weeks: number; month_start: string };
  tiles: {
    spend_mtd_vnd: number;
    leads_mtd: number;
    cpl_mtd: number | null;
    roas_mtd: number | null;
    roas_stub: boolean;
  };
  targets: {
    cpl_vnd: number | null;
    roas: number | null;
    source: 'daily_performance' | 'none';
  };
  trend: MktAiDashboardTrendWeek[];
  deltas: {
    cpl_vs_target_pct: number | null;
    spend_vs_prev_week_pct: number | null;
  };
  flags: { perf_tables_ready: boolean };
  messages: string[];
}

export interface MktAiOptimizeRecommendation {
  id: string;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  suggested_task: { stage: string; title: string; description: string };
}

export interface MktAiOptimizeBody {
  channel?: 'meta' | 'google' | 'all';
  confirm_create_tasks?: boolean;
  recommendation_ids?: string[];
  dismissed_recommendation_ids?: string[];
}

export interface MktAiOptimizeKpiContext {
  cpl_delta_pct: number | null;
  spend_vs_prev_week_pct: number | null;
  spend_mtd_vnd: number;
  leads_mtd: number;
  cpl_mtd: number | null;
  roas_mtd: number | null;
  roas_stub: boolean;
  linked: boolean;
  target_cpl_vnd: number | null;
}

export interface MktAiOptimizeResult {
  ok: boolean;
  job_id: number;
  status: 'succeeded' | 'failed';
  kpi_context: MktAiOptimizeKpiContext;
  recommendations: MktAiOptimizeRecommendation[];
  tasks_created?: Array<{ task_id: number; title: string; recommendation_id: string }>;
}

export const REQUIRED_BRIEF_FIELDS = [
  'brand_name',
  'industry',
  'service_slug',
  'objective',
  'budget_monthly_vnd',
  'geo_markets',
  'challenges',
] as const;

export const BRIEF_FIELD_LABELS: Record<string, string> = {
  brand_name: 'Tên thương hiệu / KH',
  industry: 'Ngành',
  service_slug: 'Dịch vụ RNOSAI',
  objective: 'Mục tiêu chiến dịch',
  budget_monthly_vnd: 'Ngân sách tháng (VND)',
  geo_markets: 'Thị trường / Geo',
  challenges: 'Thách thức / pain',
};
