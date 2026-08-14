import { API_BASE, ApiError, parseJson } from './api';

export class ResearchApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
    readonly messages?: string[],
  ) {
    super(message, status);
    this.name = 'ResearchApiError';
  }
}

export const INSIGHT_STATUSES = [
  'draft',
  'evidence_attached',
  'analyst_verified',
  'peer_reviewed',
  'approved_internal',
  'approved_client_facing',
  'published',
  'superseded',
  'expired',
  'rejected',
] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const INSIGHT_STATUS_LABELS: Record<InsightStatus, string> = {
  draft: 'Nháp',
  evidence_attached: 'Đã gắn evidence',
  analyst_verified: 'Analyst đã verify',
  peer_reviewed: 'Peer review',
  approved_internal: 'Duyệt nội bộ',
  approved_client_facing: 'Duyệt bản khách',
  published: 'Đã phát hành',
  superseded: 'Thay thế',
  expired: 'Hết hạn',
  rejected: 'Từ chối',
};

export function canSubmitInsightReview(status: InsightStatus | null | undefined): boolean {
  return status == null || status === 'draft' || status === 'evidence_attached' || status === 'rejected';
}

export function hasPersistedInsightRubric(
  insight: Pick<ResearchInsight, 'confidence_json'>,
): boolean {
  const raw = insight.confidence_json;
  if (!raw || typeof raw !== 'object') return false;
  if ('band' in raw && (raw as ConfidenceJson).band) return true;
  const nested = 'rubric' in raw && raw.rubric && typeof raw.rubric === 'object' ? raw.rubric : raw;
  const src = nested as Partial<ConfidenceRubric>;
  return RUBRIC_DIMS.every((d) => typeof src[d] === 'number');
}

export const INSIGHT_GATE_COPY: Record<string, string> = {
  missing_verified_evidence: 'Cần ≥1 evidence đã verify',
  missing_confidence_rationale: 'Thiếu giải thích độ tin cậy',
  missing_confidence_rubric: 'Thiếu rubric 5 chiều (0–4)',
  forbidden_confidence_wording: 'Không ghi 95% confidence trừ khi đây là inference thống kê.',
  cannot_self_approve: 'Người tạo không tự duyệt — nhờ Research Lead.',
};

export const RUBRIC_DIMS = ['S', 'F', 'T', 'A', 'R'] as const;
export type RubricDim = (typeof RUBRIC_DIMS)[number];

export type ConfidenceRubric = {
  S: number;
  F: number;
  T: number;
  A: number;
  R: number;
  statistical_inference?: boolean;
};

export type ConfidenceBand = 'low' | 'medium' | 'high' | 'very_high';

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  very_high: 'Rất cao',
};

export type ConfidenceJson = {
  rubric: ConfidenceRubric;
  score: number;
  band: ConfidenceBand;
  override_down?: boolean;
};

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
  job_in_flight: 'Job đang chạy cho câu hỏi này',
  tavily_unconfigured: 'Chưa cấu hình Tavily — job failed, project không đổi.',
  tavily_credit_cap: 'Hết credit Tavily của dự án',
  jobs_disabled: 'Hàng đợi job đang tắt — thử lại sau.',
  deep_research_disabled: 'Deep Research đang tắt.',
  llm_unconfigured: 'Chưa cấu hình Claude (ANTHROPIC_API_KEY).',
  llm_provider_error: 'Claude không trả lời được — thử lại sau.',
  llm_timeout: 'Claude hết thời gian chờ.',
  methodology_incomplete: 'Gói TC/CS bắt buộc phụ lục phương pháp trước khi xuất.',
};

export type MethodologyBlock = {
  population: string;
  source_plan: string;
  limitation: string;
  stub?: boolean;
};

export const METHODOLOGY_EXPORT_BANNER =
  'Gói TC/CS bắt buộc phụ lục phương pháp trước khi xuất.';

export function isMethodologyComplete(
  m: Pick<MethodologyBlock, 'population' | 'source_plan' | 'limitation'>,
): boolean {
  return [m.population, m.source_plan, m.limitation].every(
    (f) => String(f ?? '').trim().length >= 8,
  );
}

export function isMethodologyExportable(
  tier: 'CB' | 'TC' | 'CS',
  m: MethodologyBlock | undefined | null,
): boolean {
  if (tier === 'CB' && m?.stub === true) return true;
  if (!m) return tier === 'CB';
  return isMethodologyComplete(m);
}

export type ResearchReportSnapshot = {
  cover?: {
    client?: string;
    title?: string;
    confidential?: boolean;
    version?: number;
    as_of?: string;
  };
  exec?: string;
  findings?: unknown[];
  recs?: unknown[];
  methodology?: MethodologyBlock;
  evidence_index?: Array<{ ev_id: number; locator: string; insight_id: number }>;
  status?: string;
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
  lifecycle_id?: number | null;
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
  insights?: ResearchInsight[];
  ai_runs?: ResearchAiRun[];
  tavily_credits_used?: number;
  tavily_credits_limit?: number;
  deep_research_provider?: string;
  valid_transitions?: ProjectStatus[];
};

export type ResearchAiRun = {
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

export type ResearchInsight = {
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
  confidence_json?: ConfidenceJson | ConfidenceRubric | null;
  ai_generated: boolean;
  created_by: string | null;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  evidence_ids: number[];
};

export type CreateInsightBody = {
  statement: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric;
  valid_from?: string | null;
  valid_to?: string | null;
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

export type CompetitorFactKey = (typeof COMPETITOR_FACT_KEYS)[number];
export type CompetitorFact = Partial<Record<CompetitorFactKey, string | number | null>>;

export const COMPETITOR_FACT_LABELS: Record<CompetitorFactKey, string> = {
  price: 'Giá',
  share_claim: 'Share',
  channel: 'Kênh',
  message: 'Message',
  promo: 'Promo',
  geo: 'Địa bàn',
  period: 'Kỳ',
};

export type ResearchCompetitorSnapshot = {
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

export type ResearchCompetitor = {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  snapshots: ResearchCompetitorSnapshot[];
};

export type CreateCompetitorBody = {
  name: string;
  aliases?: string[];
};

export type CreateCompetitorSnapshotBody = {
  source_id: number;
  observed_at: string;
  kind: 'fact' | 'hypothesis';
  fact?: CompetitorFact;
  limitation_note?: string | null;
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
  lifecycle_id?: number | null;
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
    throw new ResearchApiError(detail, res.status, errorCode, messages);
  }
  return body;
}

export async function fetchResearchProjects(
  token: string,
  params?: { client_id?: string; status?: string; product_type?: string; q?: string; lifecycle_id?: string | number },
): Promise<{ projects: ResearchProject[] }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.product_type) qs.set('product_type', params.product_type);
  if (params?.q) qs.set('q', params.q);
  if (params?.lifecycle_id != null && params.lifecycle_id !== '') {
    qs.set('lifecycle_id', String(params.lifecycle_id));
  }
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

export async function runResearchDesk(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-desk`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function fetchResearchHealth(
  token: string,
): Promise<{ ok: true; enabled: true; deep_provider: string }> {
  return researchFetch(token, '/api/v1/research/health');
}

export async function runResearchDeep(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-deep`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function fetchResearchJob(
  token: string,
  projectId: number,
  runId: number,
): Promise<ResearchAiRun> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/jobs/${runId}`);
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

export async function createResearchInsight(
  token: string,
  projectId: number,
  body: CreateInsightBody,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/insights`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchInsight(
  token: string,
  insightId: number,
  body: Partial<CreateInsightBody>,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function attachResearchInsightEvidence(
  token: string,
  insightId: number,
  evidenceIds: number[],
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/attach-evidence`, {
    method: 'POST',
    body: JSON.stringify({ evidence_ids: evidenceIds }),
  });
}

export type SubmitInsightReviewBody = {
  confidence_json?: ConfidenceRubric;
  confidence_rationale?: string | null;
};

export async function submitResearchInsightReview(
  token: string,
  insightId: number,
  body?: SubmitInsightReviewBody,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/submit-review`, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function approveResearchInsight(
  token: string,
  insightId: number,
  body: { target_status: InsightStatus; comments?: string },
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function copilotResearchInsight(
  token: string,
  projectId: number,
  evidenceIds: number[],
): Promise<{ ok: true; insight: ResearchInsight; run_id: number }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/insights/copilot`, {
    method: 'POST',
    body: JSON.stringify({ evidence_ids: evidenceIds }),
  });
}

export type ResearchReportVersion = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  generated_by: string | null;
  content_hash: string;
  created_at: string;
};

export type ResearchReport = {
  id: number;
  project_id: number;
  template: string;
  status: string;
  created_at: string;
  versions: ResearchReportVersion[];
};

export async function fetchResearchReports(
  token: string,
  projectId: number,
): Promise<{ reports: ResearchReport[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports`);
}

export async function createResearchReport(
  token: string,
  projectId: number,
  insightIds: number[],
  methodology?: MethodologyBlock,
): Promise<{
  ok: true;
  report_id: number;
  version_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  content_hash: string;
}> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports`, {
    method: 'POST',
    body: JSON.stringify({ insight_ids: insightIds, methodology }),
  });
}

export async function exportResearchReportVersion(
  token: string,
  reportId: number,
  versionId: number,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(
    `${API_BASE}/api/v1/research/reports/${reportId}/versions/${versionId}/export`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ResearchApiError(
      body.message ?? body.error ?? `Export failed (${res.status})`,
      res.status,
      body.error,
    );
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? `research-report-${reportId}.docx`;
  return { blob: await res.blob(), filename };
}

export type PlanInsightSnapshot = {
  client_id: string;
  insight_ids: number[];
  inserted_at: string;
  inserted_by: string;
};

export async function fetchApprovedInsightsForClient(
  token: string,
  clientId: string,
): Promise<{ insights: ResearchInsight[] }> {
  const qs = new URLSearchParams({ client_id: clientId });
  return researchFetch(token, `/api/v1/research/insights?${qs.toString()}`);
}

export async function insertPlanInsights(
  token: string,
  planId: number,
  body: { client_id: string; insight_ids: number[] },
): Promise<{ ok: true; snapshot: PlanInsightSnapshot }> {
  return researchFetch(token, `/api/v1/research/plans/${planId}/insights`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: body.client_id,
      insight_ids: body.insight_ids,
    }),
  });
}

export function parsePlanInsightSnapshot(raw: unknown): PlanInsightSnapshot | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text || text === '{}') return null;
    try {
      obj = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const ids = Array.isArray(rec.insight_ids)
    ? rec.insight_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (!ids.length) return null;
  return {
    client_id: String(rec.client_id ?? ''),
    insight_ids: ids,
    inserted_at: String(rec.inserted_at ?? ''),
    inserted_by: String(rec.inserted_by ?? ''),
  };
}

export async function fetchResearchCompetitors(
  token: string,
  projectId: number,
): Promise<{ competitors: ResearchCompetitor[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/competitors`);
}

export async function createResearchCompetitor(
  token: string,
  projectId: number,
  body: CreateCompetitorBody,
): Promise<ResearchCompetitor> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/competitors`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchCompetitor(
  token: string,
  competitorId: number,
  body: { name?: string; aliases?: string[] },
): Promise<ResearchCompetitor> {
  return researchFetch(token, `/api/v1/research/competitors/${competitorId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function createResearchCompetitorSnapshot(
  token: string,
  competitorId: number,
  body: CreateCompetitorSnapshotBody,
): Promise<ResearchCompetitorSnapshot> {
  return researchFetch(token, `/api/v1/research/competitors/${competitorId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function copilotResearchReport(
  token: string,
  projectId: number,
  insightIds: number[],
): Promise<{
  ok: true;
  report_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  run_id: number;
}> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports/copilot`, {
    method: 'POST',
    body: JSON.stringify({ insight_ids: insightIds }),
  });
}
