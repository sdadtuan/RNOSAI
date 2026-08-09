import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function cmktFetch<T>(
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
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/content-marketing${path}`,
    { ...init, headers },
  );
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Content OS request failed', res.status);
  }
  return body;
}

export type ContentOsContext = {
  ok: boolean;
  lifecycle_id: number;
  service_slug: string;
  stage: string;
  enabled: boolean;
  snapshot?: {
    id: number;
    sealed: boolean;
    pillars_count: number;
    ingested_at: string;
    marketing_plan_id: number | null;
  } | null;
  counts: {
    ideas: number;
    items_by_status: Record<string, number>;
    draft: number;
    in_review: number;
    published_mtd: number;
    in_review_sla_breach: number;
  };
  flags: {
    ai_enabled: boolean;
    approval_required: boolean;
    media_enabled: boolean;
    client_gate: boolean;
    fe_enabled: boolean;
  };
  channel_defaults: string[];
};

export type ContentOsIdea = {
  id: number;
  lifecycle_id: number;
  pillar_id: number | null;
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  source: string;
  status: string;
  meta_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ContentOsItem = {
  id: number;
  lifecycle_id: number;
  idea_id: number | null;
  title: string;
  format: string;
  channel: string;
  funnel_goal: string;
  status: string;
  brief_json: Record<string, unknown>;
  body_json: { markdown?: string; html?: string; variants?: string[] };
  selected_variant_idx: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const CMKT_P0_PAIRS = [
  { channel: 'website', format: 'blog', label: 'Website / Blog' },
  { channel: 'facebook', format: 'social_post', label: 'Facebook — bài viết' },
  { channel: 'facebook', format: 'carousel', label: 'Facebook — carousel' },
  { channel: 'linkedin', format: 'social_post', label: 'LinkedIn — bài viết' },
  { channel: 'linkedin', format: 'carousel', label: 'LinkedIn — carousel' },
] as const;

export function fetchContentOsContext(token: string, lifecycleId: number): Promise<ContentOsContext> {
  return cmktFetch(token, lifecycleId, '/context');
}

export function fetchContentOsIdeas(
  token: string,
  lifecycleId: number,
  params?: { status?: string },
): Promise<{ ideas: ContentOsIdea[] }> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return cmktFetch(token, lifecycleId, `/ideas${q}`);
}

export function postContentOsIdea(
  token: string,
  lifecycleId: number,
  body: { title: string; hook?: string; target_goal?: string },
): Promise<ContentOsIdea> {
  return cmktFetch(token, lifecycleId, '/ideas', { method: 'POST', body: JSON.stringify(body) });
}

export function postContentOsIdeaConvert(
  token: string,
  lifecycleId: number,
  ideaId: number,
  body: { channel: string; format: string; title?: string },
): Promise<{ idea: ContentOsIdea; item: ContentOsItem }> {
  return cmktFetch(token, lifecycleId, `/ideas/${ideaId}/convert`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsItems(
  token: string,
  lifecycleId: number,
): Promise<{ items: ContentOsItem[] }> {
  return cmktFetch(token, lifecycleId, '/items');
}

export function fetchContentOsItem(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`);
}

export function patchContentOsItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: Record<string, unknown>,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function channelFormatLabel(channel: string, format: string): string {
  const hit = CMKT_P0_PAIRS.find((p) => p.channel === channel && p.format === format);
  return hit?.label ?? `${channel} / ${format}`;
}
