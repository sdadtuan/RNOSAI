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
