import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function mktAiFetch<T>(
  token: string,
  lifecycleId: number,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/ai-planner${path}`,
    { ...init, headers },
  );
  const body = await parseJson<
    T & {
      error?: string;
      message?: string;
      missing?: string[];
      messages?: string[];
    }
  >(res);
  if (!res.ok) {
    const detail =
      body.messages?.join(' · ') ??
      body.message ??
      body.error ??
      'AI Planner request failed';
    throw new ApiError(detail, res.status);
  }
  return body;
}

export interface MktAiBrief {
  brand_name?: string;
  industry?: string;
  service_slug?: string;
  objective?: string;
  budget_monthly_vnd?: number;
  geo_markets?: string[];
  competitors?: string[];
  challenges?: string;
  usp?: string;
  website_url?: string;
  timeline_start?: string;
  timeline_end?: string;
  notes?: string;
}

export interface MktAiBriefValidation {
  ok: boolean;
  missing: string[];
  messages: string[];
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

export interface MktAiDraft {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, unknown>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
}

export interface MktAiJobRow {
  id: number;
  lifecycle_id: number;
  job_type: string;
  status: string;
  model_name: string;
  error_message: string | null;
  latency_ms: number | null;
  actor_email: string;
  created_at: string;
  ended_at: string | null;
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
  };
  flags: { rag_enabled: boolean; approval_required: boolean; stub_mode: boolean };
}

export async function fetchMktAiPlannerContext(
  token: string,
  lifecycleId: number,
): Promise<MktAiPlannerContext> {
  return mktAiFetch<MktAiPlannerContext>(token, lifecycleId, '/context');
}

export async function patchMktAiBrief(
  token: string,
  lifecycleId: number,
  body: Partial<MktAiBrief>,
): Promise<{ brief: MktAiBrief; brief_validation: MktAiBriefValidation }> {
  return mktAiFetch(token, lifecycleId, '/brief', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function patchMktAiDraft(
  token: string,
  lifecycleId: number,
  body: Partial<MktAiDraft>,
): Promise<MktAiDraft> {
  return mktAiFetch(token, lifecycleId, '/draft', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function postMktAiStrategyJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/strategy', {
    method: 'POST',
  });
}

export async function postMktAiCampaignsJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/campaigns', {
    method: 'POST',
  });
}

export async function postMktAiContentJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/content', {
    method: 'POST',
  });
}

export async function postMktAiQualityJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/quality', {
    method: 'POST',
  });
}

export async function postMktAiJobRetry(
  token: string,
  lifecycleId: number,
  type: 'strategy' | 'campaigns' | 'content' | 'quality',
) {
  return mktAiFetch<{ job_id: number; status: string }>(
    token,
    lifecycleId,
    `/jobs/${type}/retry`,
    { method: 'POST' },
  );
}

export async function postMktAiApply(
  token: string,
  lifecycleId: number,
  body: {
    confirm_overwrite: boolean;
    strategy_framework?: Record<string, string>;
    target_market_prof?: Record<string, string>;
  },
) {
  return mktAiFetch<{
    plan: Record<string, unknown>;
    tmmt_validation: { ok: boolean; messages: string[] };
    filled_count?: number;
  }>(token, lifecycleId, '/apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postMktAiExport(
  token: string,
  lifecycleId: number,
  format: 'pdf' | 'docx' | 'xlsx',
) {
  return mktAiFetch<{
    format: string;
    filename: string;
    content: string;
    mime_type: string;
  }>(token, lifecycleId, '/export', {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
}
