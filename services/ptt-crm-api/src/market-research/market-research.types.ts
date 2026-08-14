import type { InsightStatus, ProductType, ProjectStatus } from './market-research.constants';

export type Dv12Tier = 'CB' | 'TC' | 'CS';
export type RiskClass = 'low' | 'medium' | 'high';

export type CreateProjectQuestionInput = {
  question_vi: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
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

export type ResearchProjectDetail = ResearchProjectRow & {
  questions: ResearchQuestionRow[];
  sources: ResearchSourceRow[];
  evidence: ResearchEvidenceRow[];
  insights: ResearchInsightRow[];
  valid_transitions: ProjectStatus[];
};

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
  valid_from?: string | null;
  valid_to?: string | null;
};

export type PatchInsightInput = {
  statement?: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
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
  confidence_json: unknown | null;
  ai_generated: boolean;
  created_by: string | null;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  evidence_ids: number[];
};
