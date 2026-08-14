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
  evidence_immutable: 'Evidence đã khóa (verified / superseded / rejected) — không sửa được',
  evidence_duplicate_checksum: 'Checksum trùng evidence đã verify trong project',
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
  sources?: ResearchSource[];
  evidence?: ResearchEvidence[];
  valid_transitions?: ProjectStatus[];
};

export type ResearchSource = {
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
  ai_generated: boolean;
  keep: boolean | null;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ResearchEvidence = {
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

export type CreateSourceBody = {
  title: string;
  source_type?: string;
  publisher?: string;
  url?: string;
  published_at?: string;
  accessed_at?: string;
  geo?: string;
  license_note?: string;
  reliability_tier?: string;
  question_id?: number | null;
};

export type CreateEvidenceBody = {
  source_id?: number | null;
  study_id?: number | null;
  question_id?: number | null;
  locator: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
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
    T & {
      error?: string;
      message?: string | { error?: string; messages?: string[]; reason?: string };
      messages?: string[];
      reason?: string;
    }
  >(res);
  if (!res.ok) {
    const nested = typeof body.message === 'object' && body.message ? body.message : null;
    const errorCode = nested?.error ?? body.error;
    const messages = body.messages ?? nested?.messages;
    const reason = body.reason ?? nested?.reason;
    const detail =
      messages?.join(' · ') ??
      (reason ? TRANSITION_REASON_VI[reason] ?? reason : undefined) ??
      (typeof body.message === 'string' ? body.message : undefined) ??
      (errorCode ? TRANSITION_REASON_VI[errorCode] ?? errorCode : undefined) ??
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

export async function createResearchSource(
  token: string,
  projectId: number,
  body: CreateSourceBody,
): Promise<ResearchSource> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/sources`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchSourceKeep(
  token: string,
  sourceId: number,
  keep: boolean,
): Promise<ResearchSource> {
  return researchFetch(token, `/api/v1/research/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ keep }),
  });
}

export async function createResearchEvidence(
  token: string,
  projectId: number,
  body: CreateEvidenceBody,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchEvidence(
  token: string,
  evidenceId: number,
  body: Partial<CreateEvidenceBody>,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function verifyResearchEvidence(
  token: string,
  evidenceId: number,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}/verify`, { method: 'POST' });
}

export async function supersedeResearchEvidence(
  token: string,
  evidenceId: number,
  body: CreateEvidenceBody,
): Promise<{ old: ResearchEvidence; evidence: ResearchEvidence }> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}/supersede`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
