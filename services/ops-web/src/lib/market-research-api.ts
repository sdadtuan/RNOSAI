import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const PRODUCT_TYPES = [
  'CAT_REVIEW',
  'COMP_LAND',
  'CONSUMER',
  'SEG_STP',
  'BRAND_HEALTH',
  'PRICE_OFFER',
  'CAMPAIGN',
  'TREND_SCAN',
  'GTM',
  'TRACKER',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PROJECT_STATUSES = [
  'intake',
  'designed',
  'collecting',
  'qc',
  'analyzing',
  'synthesizing',
  'drafting',
  'in_review',
  'approved',
  'distributed',
  'archived',
  'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRODUCT_TYPE_CARDS: Array<{ type: ProductType; label: string; subcopy: string }> = [
  { type: 'CAT_REVIEW', label: 'Category review', subcopy: 'TAM/SAM/SOM, cấu trúc ngành' },
  { type: 'COMP_LAND', label: 'Competitive landscape', subcopy: 'Đối thủ, positioning, SOV proxy' },
  { type: 'CONSUMER', label: 'Consumer / shopper', subcopy: 'JTBD, pain, ngôn ngữ thật' },
  { type: 'SEG_STP', label: 'Segmentation / STP', subcopy: 'Priority segment' },
  { type: 'BRAND_HEALTH', label: 'Brand health', subcopy: 'Funnel, equity' },
  { type: 'PRICE_OFFER', label: 'Pricing / offer', subcopy: 'Giá, gói' },
  { type: 'CAMPAIGN', label: 'Campaign / concept', subcopy: 'Đánh giá ads' },
  { type: 'TREND_SCAN', label: 'Trend scan', subcopy: 'Tín hiệu 6–18 tháng' },
  { type: 'GTM', label: 'Go-to-market', subcopy: 'Kênh + message' },
  { type: 'TRACKER', label: 'Tracker', subcopy: 'Pulse lặp' },
];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Tiếp nhận',
  designed: 'Thiết kế',
  collecting: 'Thu thập',
  qc: 'QC',
  analyzing: 'Phân tích',
  synthesizing: 'Tổng hợp',
  drafting: 'Soạn báo cáo',
  in_review: 'Đang duyệt',
  approved: 'Đã duyệt',
  distributed: 'Đã giao',
  archived: 'Lưu trữ',
  cancelled: 'Huỷ',
};

export const TRANSITION_REASON_VI: Record<string, string> = {
  need_rq: 'Cần ≥1 câu hỏi nghiên cứu',
  cannot_revert_approved: 'Không thể hoàn trạng thái đã duyệt',
  need_verified_insight: 'Cần ≥1 insight đã verify',
};

export type ResearchQuestion = {
  id: number;
  project_id: number;
  sort_order: number;
  question_vi: string;
  question_en: string | null;
  analysis_frame: string | null;
  created_at: string;
};

export type ResearchProject = {
  id: number;
  client_id: string;
  client_name: string | null;
  title: string;
  product_type: ProductType;
  dv12_tier: 'CB' | 'TC' | 'CS';
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: 'low' | 'medium' | 'high';
  status: ProjectStatus;
  owner_user_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  rq_count: number;
  verified_insight_count: number;
  questions?: ResearchQuestion[];
  valid_transitions?: ProjectStatus[];
};

export type CreateProjectBody = {
  client_id: string;
  title: string;
  product_type: ProductType;
  dv12_tier: 'CB' | 'TC' | 'CS';
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: 'low' | 'medium' | 'high';
  questions: Array<{ question_vi: string; question_en?: string; sort_order?: number }>;
};

async function researchFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  const body = await parseJson<
    T & { error?: string; message?: string; messages?: string[]; reason?: string }
  >(res);
  if (!res.ok) {
    const detail =
      body.messages?.join(' · ') ??
      (body.reason ? TRANSITION_REASON_VI[body.reason] ?? body.reason : undefined) ??
      body.message ??
      body.error ??
      'Yêu cầu nghiên cứu thất bại';
    throw new ApiError(detail, res.status);
  }
  return body;
}

export async function fetchResearchProjects(
  token: string,
  params?: { client_id?: string; status?: string; product_type?: string; q?: string },
): Promise<{ projects: ResearchProject[] }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.product_type) qs.set('product_type', params.product_type);
  if (params?.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return researchFetch(token, `/api/v1/research/projects${suffix}`);
}

export async function createResearchProject(
  token: string,
  body: CreateProjectBody,
): Promise<{ ok: true; project: ResearchProject }> {
  return researchFetch(token, '/api/v1/research/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchProject(token: string, id: number): Promise<ResearchProject> {
  return researchFetch(token, `/api/v1/research/projects/${id}`);
}

export async function patchResearchProject(
  token: string,
  id: number,
  body: Partial<CreateProjectBody> & { status?: ProjectStatus },
): Promise<ResearchProject> {
  return researchFetch(token, `/api/v1/research/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function addResearchQuestion(
  token: string,
  projectId: number,
  body: { question_vi: string; question_en?: string },
): Promise<ResearchQuestion> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchQuestion(
  token: string,
  questionId: number,
  body: { question_vi?: string; question_en?: string | null },
): Promise<ResearchQuestion> {
  return researchFetch(token, `/api/v1/research/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteResearchQuestion(token: string, questionId: number): Promise<{ ok: true }> {
  return researchFetch(token, `/api/v1/research/questions/${questionId}`, { method: 'DELETE' });
}
