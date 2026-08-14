import type { ProductType, ProjectStatus } from './market-research.constants';

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
  valid_transitions: ProjectStatus[];
};
