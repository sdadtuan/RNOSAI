import type { InsightStatus, ProductType, ProjectStatus } from './market-research.constants';

export type Dv12Tier = 'CB' | 'TC' | 'CS';
export type RiskClass = 'low' | 'medium' | 'high';
export type ResearchExportFormat = 'docx' | 'pdf';

export const RUBRIC_DIMS = ['S', 'F', 'T', 'A', 'R'] as const;
export type RubricDim = (typeof RUBRIC_DIMS)[number];

export type ConfidenceRubric = {
  S: number; // source quality 0–4
  F: number; // fit & coverage
  T: number; // triangulation
  A: number; // analytical robustness
  R: number; // recency & stability
  statistical_inference?: boolean;
};

export type ConfidenceBand = 'low' | 'medium' | 'high' | 'very_high';

export type ConfidenceJson = {
  rubric: ConfidenceRubric;
  score: number;
  band: ConfidenceBand;
  override_down?: boolean;
};

export const COMPETITOR_FACT_KEYS = [
  'price',
  'share_claim',
  'channel',
  'message',
  'promo',
  'geo',
  'period',
] as const;

export type CompetitorFact = Partial<Record<(typeof COMPETITOR_FACT_KEYS)[number], string | number | null>>;

export type PlanInsightSnapshot = {
  client_id: string;
  insight_ids: number[];
  inserted_at: string;
  inserted_by: string;
};

export type MethodologyBlock = {
  population: string;
  source_plan: string;
  limitation: string;
  stub?: boolean;
};

export type InsertPlanInsightsInput = {
  client_id: string;
  insight_ids: number[];
};

export type CreateCompetitorInput = {
  name: string;
  aliases?: string[];
};

export type PatchCompetitorInput = {
  name?: string;
  aliases?: string[];
};

export type CreateCompetitorSnapshotInput = {
  source_id?: number;
  observed_at?: string;
  kind?: string;
  fact?: unknown;
  limitation_note?: string | null;
};

export type ResearchCompetitorSnapshotRow = {
  id: number;
  competitor_id: number;
  project_id: number;
  source_id: number;
  observed_at: string;
  kind: 'fact' | 'hypothesis';
  fact: CompetitorFact;
  limitation_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type ResearchCompetitorRow = {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  snapshots: ResearchCompetitorSnapshotRow[];
};

export const STUDY_METHODS = ['survey', 'idi', 'fgd', 'diary'] as const;
export type StudyMethod = (typeof STUDY_METHODS)[number];

export const STUDY_MODES = ['online', 'f2f', 'phone', 'mixed'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export type ResearchStudy = {
  id: number;
  project_id: number;
  name: string;
  method: StudyMethod;
  n: number | null;
  field_start: string | null;
  field_end: string | null;
  mode: StudyMode | null;
  instrument_version: string | null;
  weighting_note: string | null;
};

export type ResearchConsent = {
  id: number;
  study_id: number;
  project_id: number;
  subject_code: string; // pseudonym R-004 — not a person name
  consent_type: 'record' | 'quote' | 'store';
  recorded_at: string;
  expires_at: string;
  notes: string | null;
};

export type ReportExec = {
  vi: string;
  en: string | null;
  en_status: 'none' | 'draft' | 'approved';
};

export type TrendSignal = {
  id: number;
  project_id: number;
  topic: string;
  metric: string;
  baseline: number | null;
  current: number | null;
  velocity: number | null;
  lifecycle: 'new' | 'rising' | 'stable' | 'fading';
};

export type OpsAnalytics = {
  cycle_time_hours: {
    designed_to_approved_p50: number | null;
    sample: number;
  };
  evidence_completeness: {
    projects: number;
    with_verified_pct: number;
  };
  activation: {
    distributed_projects: number;
    approved_reports: number;
  };
};

export type OpsAnalyticsProjectRow = {
  id: number;
  client_id: string;
  status: ProjectStatus;
  verified_ev: number;
};

export type OpsAnalyticsPayload = OpsAnalytics & {
  projects: OpsAnalyticsProjectRow[];
};

export type OpsAnalyticsRaw = {
  cycleHours: number[];
  totalProjects: number;
  withVerified: number;
  distributedProjects: number;
  approvedReports: number;
  projects: OpsAnalyticsProjectRow[];
};

export const CONSENT_TYPES = ['record', 'quote', 'store'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export type CreateStudyInput = {
  name: string;
  method: string;
  n?: number | null;
  field_start?: string | null;
  field_end?: string | null;
  mode?: string | null;
  instrument_version?: string | null;
  weighting_note?: string | null;
};

export type PatchStudyInput = {
  name?: string;
  n?: number | null;
  field_start?: string | null;
  field_end?: string | null;
  mode?: string | null;
  instrument_version?: string | null;
  weighting_note?: string | null;
};

export type CreateConsentInput = {
  subject_code: string;
  consent_type: string;
  notes?: string | null;
};

export type CreateProjectQuestionInput = {
  question_vi: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type ResearchPrefill = {
  industry: string | null;
  competitor_names: string[];
  suggested_rqs: string[];
};

export type CreateProjectInput = {
  client_id: string;
  title: string;
  product_type: string;
  dv12_tier?: string;
  decision_statement: string;
  geo?: string[];
  languages?: string[];
  risk_class?: string;
  lifecycle_id?: number | null;
  questions: CreateProjectQuestionInput[];
  prefill_competitors?: string[];
};

export type PatchProjectInput = {
  title?: string;
  decision_statement?: string;
  geo?: string[];
  languages?: string[];
  risk_class?: string;
  dv12_tier?: string;
  status?: string;
};

export type CreateQuestionInput = {
  question_vi: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type PatchQuestionInput = {
  question_vi?: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type ListProjectsFilters = {
  client_id?: string;
  status?: string;
  product_type?: string;
  q?: string;
  lifecycle_id?: number;
};

export type ResearchQuestionRow = {
  id: number;
  project_id: number;
  sort_order: number;
  question_vi: string;
  question_en: string | null;
  analysis_frame: string | null;
  created_at: string;
};

export type ResearchProjectRow = {
  id: number;
  client_id: string;
  client_name: string | null;
  lifecycle_id: number | null;
  title: string;
  product_type: ProductType;
  dv12_tier: Dv12Tier;
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: RiskClass;
  status: ProjectStatus;
  owner_user_id: number | null;
  data_residency: string | null;
  related_sales_market_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  rq_count: number;
  verified_insight_count: number;
};

export type ResearchAiRunRow = {
  id: number;
  project_id: number;
  question_id: number | null;
  job_type: string;
  provider: string;
  model: string | null;
  status: string;
  credits_used: number;
  error_message: string | null;
  actor: string | null;
  created_at: string;
  finished_at: string | null;
};

export type ResearchProjectDetail = ResearchProjectRow & {
  questions: ResearchQuestionRow[];
  sources: ResearchSourceRow[];
  evidence: ResearchEvidenceRow[];
  insights: ResearchInsightRow[];
  ai_runs: ResearchAiRunRow[];
  trend_signals: TrendSignal[];
  tavily_credits_used: number;
  tavily_credits_limit: number;
  deep_research_provider: string;
  valid_transitions: ProjectStatus[];
};

export type RunDeskInput = {
  question_id: number;
};

export type RunDeskResult = {
  ok: true;
  run_id: number;
  status: string;
  note?: string;
};

export type RunDeepInput = {
  question_id: number;
};

export type RunDeepResult = RunDeskResult;

export type RunTriangulateResult = RunDeskResult;

export type RunPulseInput = {
  question_id?: number;
};

export type RunPulseResult = RunDeskResult;

export type CreateSourceInput = {
  title: string;
  source_type?: string;
  publisher?: string | null;
  url?: string | null;
  published_at?: string | null;
  accessed_at?: string | null;
  geo?: string | null;
  license_note?: string | null;
  reliability_tier?: string;
  question_id?: number | null;
};

export type PatchSourceInput = {
  keep: boolean;
};

export type CreateEvidenceInput = {
  source_id?: number | null;
  study_id?: number | null;
  question_id?: number | null;
  locator?: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
};

export type PatchEvidenceInput = {
  locator?: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
  question_id?: number | null;
};

export type ResearchSourceRow = {
  id: number;
  project_id: number;
  question_id: number | null;
  source_type: string;
  title: string;
  publisher: string | null;
  url: string | null;
  published_at: string | null;
  accessed_at: string | null;
  geo: string | null;
  license_note: string | null;
  reliability_tier: string;
  snapshot_uri: string | null;
  content_hash: string | null;
  ai_generated: boolean;
  keep: boolean | null;
  triangulated: boolean;
  single_source_accepted: boolean;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ResearchEvidenceRow = {
  id: number;
  project_id: number;
  source_id: number | null;
  study_id: number | null;
  question_id: number | null;
  locator: string;
  excerpt: string | null;
  value_num: number | null;
  unit: string | null;
  value_base: string | null;
  period_note: string | null;
  geography: string | null;
  captured_at: string;
  pii_class: string;
  qc_status: string;
  checksum: string | null;
  created_by: string | null;
  superseded_by: number | null;
  created_at: string;
  pii_warning?: boolean;
};

export type CreateInsightInput = {
  statement: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric | ConfidenceJson;
  valid_from?: string | null;
  valid_to?: string | null;
  ai_generated?: boolean;
};

export type InsightCopilotInput = {
  evidence_ids: number[];
};

export type ReportCopilotInput = {
  insight_ids: number[];
};

export type CreateReportInput = {
  insight_ids: number[];
  methodology?: MethodologyBlock;
};

export type UpdateExecEnInput = {
  en: string;
};

export type UpdateReportEmbargoInput = {
  embargo_until?: string | null;
  expires_at?: string | null;
};

export type PublishPortalInput = {
  visible: boolean;
};

export type ResearchReportVersionRow = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  generated_by: string | null;
  content_hash: string;
  embargo_until: string | null;
  expires_at: string | null;
  portal_visible: boolean;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
};

export type PortalResearchReportCard = {
  version_id: number;
  version: number;
  as_of: string | null;
  expires_at: string | null;
  watermark: string;
};

export type PortalResearchReportDetail = PortalResearchReportCard & {
  exec: { vi: string; en: string | null };
  findings: unknown[];
  recs: unknown[];
  methodology: unknown;
  evidence_index: unknown[];
};

export type ResearchWave = {
  id: number;
  project_id: number;
  wave_no: number;
  label: string | null;
  field_start: string | null;
  field_end: string | null;
  metric_json: { key: string; value: number | null }[];
  created_at: string;
};

export type CreateWaveInput = {
  wave_no: number;
  label?: string | null;
  field_start?: string | null;
  field_end?: string | null;
  metric_json: { key: string; value: number | null }[];
};

export type WaveCompareRow = {
  key: string;
  prev: number | null;
  curr: number | null;
  delta: number | null;
};

export const DECISION_STATUSES = ['open', 'done', 'dropped'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export type ResearchDecision = {
  id: number;
  project_id: number;
  insight_id: number;
  decision_text: string;
  owner_email: string;
  due_at: string | null;
  status: DecisionStatus;
  created_by: string | null;
  created_at: string;
};

export type CreateDecisionInput = {
  insight_id: number;
  decision_text: string;
  owner_email: string;
  due_at?: string | null;
};

export type PatchDecisionInput = {
  status?: DecisionStatus;
  due_at?: string | null;
  owner_email?: string;
  decision_text?: string;
  insight_id?: number;
};

export type ResearchReportRow = {
  id: number;
  project_id: number;
  template: string;
  status: string;
  created_at: string;
  versions: ResearchReportVersionRow[];
};

export type CreateReportResult = {
  ok: true;
  report_id: number;
  version_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  content_hash: string;
  portal_visible: boolean;
  published_by: string | null;
};

export type InsightCopilotResult = {
  ok: true;
  insight: ResearchInsightRow;
  run_id: number;
};

export type ReportCopilotResult = {
  ok: true;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  run_id: number;
};

export type PatchInsightInput = {
  statement?: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric | ConfidenceJson;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type SubmitReviewInput = {
  confidence_json?: ConfidenceRubric;
};

export type AttachInsightEvidenceInput = {
  evidence_ids: number[];
};

export type ApproveInsightInput = {
  target_status: string;
  comments?: string | null;
};

export type InsertReviewInput = {
  project_id: number;
  object_type: 'insight' | 'report' | 'source' | 'project';
  object_id: number;
  reviewer: string;
  role: string;
  decision: 'approve' | 'reject' | 'request_changes' | 'risk_accept';
  comments?: string | null;
};

export type ResearchInsightRow = {
  id: number;
  project_id: number;
  statement: string;
  observation: string | null;
  interpretation: string | null;
  implication: string | null;
  recommendation: string | null;
  audience: string | null;
  status: InsightStatus;
  confidence_rationale: string | null;
  confidence_json: ConfidenceJson | ConfidenceRubric | null;
  ai_generated: boolean;
  created_by: string | null;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  evidence_ids: number[];
};
