import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface AiHealthData {
  status: string;
  copilot_enabled?: boolean;
  schema_ready?: boolean;
}

export interface AiScoreFactor {
  key: string;
  label: string;
  delta: number;
  sign: '+' | '-';
}

export interface AiExplainability {
  factors: AiScoreFactor[];
  flags: string[];
  score_band: 'hot' | 'warm' | 'cold';
}

export interface AiScoreRecord {
  id: string;
  score_value: number;
  confidence: number | null;
  explainability_json: AiExplainability;
  model_name: string | null;
  model_version?: string;
  calculated_at: string;
}

export interface AiScoresListResponse {
  data: {
    entity_type: string;
    entity_id: string;
    scores: AiScoreRecord[];
    latest: AiScoreRecord | null;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface AiScoresBatchResponse {
  data: {
    entity_type: string;
    scores_by_entity_id: Record<string, AiScoreRecord>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface LeadScoreSummary {
  score_value: number;
  score_band: 'hot' | 'warm' | 'cold';
  confidence: number | null;
}

export interface AiSummarizeExtracted {
  intent: string | null;
  objections: string[];
  next_action: string | null;
  source: string | null;
  campaign_id: string | null;
  risk_flags: string[];
  budget_vnd: number | null;
}

export interface AiSummarizeResponse {
  data: {
    context: 'lead_brief' | 'activity';
    entity_type: string | null;
    entity_id: string | null;
    summary: string;
    bullets: string[];
    extracted: AiSummarizeExtracted;
    confidence: number;
    agent_run_id: string;
    model: string;
    stub_mode: boolean;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
}

export type SummarizeContext = 'lead_brief' | 'activity';

export type FollowUpChannelHint = 'zalo' | 'email' | 'note';

export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'executed' | 'expired';

export interface AiRecommendationResponse {
  data: {
    id: string;
    recommendation_type: string;
    entity_type: string;
    entity_id: string;
    text: string;
    channel_hint: FollowUpChannelHint;
    subject?: string | null;
    confidence: number;
    status: RecommendationStatus;
    agent_run_id: string;
    stub_mode: boolean;
    activity_id?: number;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
}

export interface AiRecommendationListResponse {
  data: {
    entity_type: string;
    entity_id: string;
    recommendations: Array<{
      id: string;
      recommendation_type?: string;
      recommendation_text: string;
      status: RecommendationStatus;
      action_json?: Record<string, unknown>;
      confidence: number | null;
      agent_run_id?: string | null;
      created_at: string;
    }>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiHealth(token?: string): Promise<AiHealthData> {
  const headers: HeadersInit = token ? authHeaders(token) : {};
  const res = await fetch(`${API_BASE}/api/v1/ai/health`, { headers, cache: 'no-store' });
  const body = await parseJson<{ data: AiHealthData; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'AI health failed', res.status);
  }
  return body.data ?? (body as unknown as AiHealthData);
}

export async function fetchAiScores(
  token: string,
  entityType: string,
  entityId: string | number,
  limit = 5,
): Promise<AiScoresListResponse> {
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_id: String(entityId),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/api/v1/ai/scores?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiScoresListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch scores failed', res.status);
  }
  return body;
}

/** UI-R1-10 — batch latest scores for leads list column. */
export async function fetchAiScoresBatch(
  token: string,
  entityType: string,
  entityIds: Array<string | number>,
): Promise<Record<string, LeadScoreSummary>> {
  const ids = [...new Set(entityIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 50);
  if (!ids.length) {
    return {};
  }
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_ids: ids.join(','),
  });
  const res = await fetch(`${API_BASE}/api/v1/ai/scores/batch?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiScoresBatchResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch scores batch failed', res.status);
  }
  const out: Record<string, LeadScoreSummary> = {};
  for (const [entityId, row] of Object.entries(body.data.scores_by_entity_id ?? {})) {
    out[entityId] = {
      score_value: row.score_value,
      score_band: row.explainability_json?.score_band ?? 'warm',
      confidence: row.confidence,
    };
  }
  return out;
}

export interface ScoreDealResponse {
  data: {
    deal_id: number;
    score: number;
    confidence: number;
    score_band: 'hot' | 'warm' | 'cold';
    explainability: AiExplainability;
    cached: boolean;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface NextBestActionResponse {
  data: {
    recommendation_id: string;
    deal_id: number;
    action: string;
    action_label: string;
    reason: string;
    confidence: number;
    status: string;
    recommendation_text: string;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function postAiScoreDeal(
  token: string,
  dealId: number,
  force = false,
): Promise<ScoreDealResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/score/deal`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: dealId, force }),
  });
  const body = await parseJson<ScoreDealResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Score deal failed', res.status);
  }
  return body;
}

export async function postAiNextBestAction(
  token: string,
  dealId: number,
  force = false,
): Promise<NextBestActionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/next-best-action`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: dealId, entity_type: 'deal', entity_id: dealId, force }),
  });
  const body = await parseJson<NextBestActionResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'NBA failed', res.status);
  }
  return body;
}

export async function postAiSummarize(
  token: string,
  input: {
    context: SummarizeContext;
    entity_type?: string;
    entity_id?: string | number;
    text?: string;
  },
): Promise<AiSummarizeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/summarize`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: input.context,
      entity_type: input.entity_type,
      entity_id: input.entity_id != null ? String(input.entity_id) : undefined,
      text: input.text,
    }),
  });
  const body = await parseJson<
    AiSummarizeResponse & { error?: string; message?: string; retry_after_sec?: number }
  >(res);
  if (!res.ok) {
    const msg =
      body.message ??
      body.error ??
      (typeof body === 'object' && body && 'error' in body ? String(body.error) : 'Summarize failed');
    throw new ApiError(msg, res.status);
  }
  return body;
}

export async function postAiRecommendation(
  token: string,
  input: {
    type?: string;
    entity_type?: string;
    entity_id?: string | number;
    channel_hint?: FollowUpChannelHint;
    context_text?: string;
  },
): Promise<AiRecommendationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendation`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: input.type ?? 'follow_up_draft',
      entity_type: input.entity_type ?? 'lead',
      entity_id: input.entity_id != null ? String(input.entity_id) : undefined,
      channel_hint: input.channel_hint,
      context_text: input.context_text,
    }),
  });
  const body = await parseJson<
    AiRecommendationResponse & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Recommendation failed', res.status);
  }
  return body;
}

export async function patchAiRecommendation(
  token: string,
  id: string,
  input: {
    status: 'accepted' | 'dismissed';
    final_text?: string;
    dismiss_reason?: string;
  },
): Promise<AiRecommendationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<
    AiRecommendationResponse & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Patch recommendation failed', res.status);
  }
  return body;
}

export async function fetchAiRecommendations(
  token: string,
  entityType: string,
  entityId: string | number,
  opts?: { status?: RecommendationStatus; limit?: number },
): Promise<AiRecommendationListResponse> {
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_id: String(entityId),
  });
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiRecommendationListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch recommendations failed', res.status);
  }
  return body;
}

/** Poll until score visible or timeout (RNOS-08 UI-R1-06). */
export async function pollAiScoreUntilReady(
  token: string,
  leadId: number,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<AiScoreRecord | null> {
  const intervalMs = opts?.intervalMs ?? 3000;
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const out = await fetchAiScores(token, 'lead', leadId, 1);
      if (out.data.latest) {
        return out.data.latest;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export const DISMISS_REASON_PRESETS = [
  { value: 'wrong_tone', label: 'Sai tone' },
  { value: 'wrong_fact', label: 'Sai thông tin' },
  { value: 'not_needed', label: 'Không cần' },
  { value: 'other', label: 'Khác' },
] as const;

export interface AiAcceptanceMetrics {
  acceptance_rate_pct: number | null;
  accepted: number;
  dismissed: number;
  pending: number;
  total_resolved: number;
  by_type: Array<{
    recommendation_type: string;
    accepted: number;
    dismissed: number;
    pending: number;
  }>;
  top_dismiss_reasons: Array<{ reason: string; count: number }>;
  from: string;
  to: string;
}

export interface AiAcceptanceMetricsResponse {
  data: AiAcceptanceMetrics;
  meta: { request_id: string };
  errors: unknown[];
}

export interface AiRecommendationInboxItem {
  id: string;
  entity_type: string;
  entity_id: string;
  recommendation_type: string;
  recommendation_text: string;
  status: string;
  dismissed_reason: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiRecommendationInboxResponse {
  data: {
    recommendations: AiRecommendationInboxItem[];
    total: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiAcceptanceMetrics(
  token: string,
  params?: { from?: string; to?: string; days?: number; recommendation_type?: string },
): Promise<AiAcceptanceMetricsResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.recommendation_type) qs.set('recommendation_type', params.recommendation_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/analytics/acceptance${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAcceptanceMetricsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI acceptance metrics failed', res.status);
  }
  return body;
}

export async function fetchAiRecommendationsInbox(
  token: string,
  params?: {
    status?: RecommendationStatus;
    from?: string;
    to?: string;
    days?: number;
    limit?: number;
    offset?: number;
  },
): Promise<AiRecommendationInboxResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations/inbox${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiRecommendationInboxResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI inbox failed', res.status);
  }
  return body;
}

export type AiAgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AiAgentRunRow {
  id: string;
  client_id: string | null;
  agent_name: string;
  use_case: string | null;
  model_name: string | null;
  prompt_hash: string | null;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: AiAgentRunStatus;
  latency_ms: number | null;
  token_usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error_message: string | null;
  correlation_id: string | null;
  actor_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  prompt_visible: boolean;
}

export interface AiAgentRunsListResponse {
  data: {
    rows: AiAgentRunRow[];
    total: number;
    limit: number;
    offset: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface AiAgentRunDetailResponse {
  data: AiAgentRunRow;
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiAgentRuns(
  token: string,
  params?: {
    from?: string;
    to?: string;
    use_case?: string;
    actor_id?: string;
    entity_type?: string;
    entity_id?: string;
    status?: AiAgentRunStatus;
    limit?: number;
    offset?: number;
  },
): Promise<AiAgentRunsListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.use_case) qs.set('use_case', params.use_case);
  if (params?.actor_id) qs.set('actor_id', params.actor_id);
  if (params?.entity_type) qs.set('entity_type', params.entity_type);
  if (params?.entity_id) qs.set('entity_id', params.entity_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/runs${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAgentRunsListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI agent runs failed', res.status);
  }
  return body;
}

export async function fetchAiAgentRunById(token: string, id: string): Promise<AiAgentRunDetailResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAgentRunDetailResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI agent run failed', res.status);
  }
  return body;
}
