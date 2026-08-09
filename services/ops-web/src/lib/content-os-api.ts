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
    source_hash?: string;
    planner_drift?: boolean;
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
  parent_item_id?: number | null;
  title: string;
  format: string;
  channel: string;
  funnel_goal: string;
  status: string;
  brief_json: Record<string, unknown>;
  body_json: { markdown?: string; html?: string; variants?: string[] };
  selected_variant_idx: number | null;
  seo_bridge_id?: number | null;
  email_bridge_id?: number | null;
  production_json?: Record<string, unknown>;
  in_review_at?: string | null;
  published_url?: string | null;
  published_at?: string | null;
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

export type ContentOsPillar = {
  id: number;
  lifecycle_id: number;
  snapshot_id: number | null;
  name: string;
  goal: string;
  topics_json: string[];
  sort_order: number;
  active: boolean;
};

export type ContentOsPlanSnapshot = {
  snapshot: {
    id: number;
    lifecycle_id: number;
    marketing_plan_id: number | null;
    sealed: boolean;
    source_hash: string;
    ingested_at: string;
    ingested_by: string;
    snapshot_json: Record<string, unknown>;
    brand_context_json: Record<string, unknown>;
  } | null;
  pillars: ContentOsPillar[];
  planner: {
    marketing_plan_id: number | null;
    has_applied_plan: boolean;
    current_source_hash: string | null;
    drift: boolean;
  };
};

export type ContentOsIngestResult = {
  ok: boolean;
  snapshot_id: number;
  ideas_created: number;
  pillars_upserted: number;
  warnings: string[];
};

export function fetchPlanSnapshot(token: string, lifecycleId: number): Promise<ContentOsPlanSnapshot> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot');
}

export function postPlanSnapshotIngest(
  token: string,
  lifecycleId: number,
  body: {
    marketing_plan_id?: number;
    mode?: 'merge' | 'replace';
    import_calendar?: boolean;
    import_pillars?: boolean;
  },
): Promise<ContentOsIngestResult> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postPlanSnapshotSeal(
  token: string,
  lifecycleId: number,
): Promise<{ ok: boolean; snapshot_id: number; sealed: boolean }> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot/seal', { method: 'POST', body: '{}' });
}

export type ContentOsJob = {
  id: number;
  lifecycle_id: number;
  item_id: number | null;
  job_type: string;
  status: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_text: string | null;
  ai_run_id: string | null;
  created_by: string;
  created_at: string;
  finished_at: string | null;
};

export type ContentOsItemVersion = {
  id: number;
  item_id: number;
  version_no: number;
  body_json: ContentOsItem['body_json'];
  changed_by: string;
  change_reason: string;
  ai_run_id?: string | null;
  created_at: string;
};

export function postContentOsDraftJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    tone?: string;
    length?: string;
    goal?: string;
    include_outline?: boolean;
    variant_count?: number;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/draft`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsVariantsJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { tone?: string; goal?: string; variant_count?: number },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/variants`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function fetchContentOsJob(
  token: string,
  lifecycleId: number,
  jobId: number,
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/jobs/${jobId}`);
}

export function fetchContentOsItemVersions(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ versions: ContentOsItemVersion[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/versions`);
}

export function patchContentOsItemApplyVariant(
  token: string,
  lifecycleId: number,
  itemId: number,
  selectedVariantIdx: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ selected_variant_idx: selectedVariantIdx, apply_variant: true }),
  });
}

export type ContentOsReviewQueueItem = ContentOsItem & { sla_breach: boolean };

export function fetchContentOsReviewQueue(
  token: string,
  lifecycleId: number,
  params?: { sla_breach?: boolean; channel?: string },
): Promise<{ items: ContentOsReviewQueueItem[] }> {
  const q = new URLSearchParams();
  if (params?.sla_breach) q.set('sla_breach', '1');
  if (params?.channel) q.set('channel', params.channel);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return cmktFetch(token, lifecycleId, `/review-queue${suffix}`);
}

export function fetchContentOsReviewQueueSummary(
  token: string,
  lifecycleId: number,
): Promise<{ total: number; sla_breach: number; by_channel: Record<string, number> }> {
  return cmktFetch(token, lifecycleId, '/review-queue/summary');
}

export function postContentOsSubmitReview(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/submit-review`, { method: 'POST', body: '{}' });
}

export function postContentOsApproveItem(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/approve`, { method: 'POST', body: '{}' });
}

export function postContentOsRejectItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  comment: string,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function postContentOsPublishItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { published_url?: string },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/publish`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export type ContentOsCalendarSlot = {
  id: number;
  lifecycle_id: number;
  item_id: number;
  scheduled_at: string;
  timezone: string;
  reminder_sent: boolean;
  item?: ContentOsItem;
};

export function fetchContentOsCalendar(
  token: string,
  lifecycleId: number,
  params?: { from?: string; to?: string },
): Promise<{ slots: ContentOsCalendarSlot[] }> {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return cmktFetch(token, lifecycleId, `/calendar${suffix}`);
}

export function putContentOsCalendarSlot(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { scheduled_at: string; timezone?: string },
): Promise<{ slot: ContentOsCalendarSlot; item: ContentOsItem }> {
  return cmktFetch(token, lifecycleId, `/calendar/slots/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export type ContentOsAuditRow = {
  item_id: number;
  item_title: string;
  version_no: number;
  change_reason: string;
  changed_by: string;
  created_at: string;
  ai_run_id: string | null;
  agent_name?: string | null;
  use_case?: string | null;
};

export function fetchContentOsAudit(
  token: string,
  lifecycleId: number,
  limit = 50,
): Promise<{ audit: ContentOsAuditRow[] }> {
  return cmktFetch(token, lifecycleId, `/audit?limit=${limit}`);
}

export function copyCaptionText(item: ContentOsItem): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  const lines = md.split('\n').filter(Boolean);
  return lines[0] ?? md;
}

export type ContentOsRepurposeTarget = { channel: string; format: string; count?: number };

export type ContentOsDerivation = {
  id: number;
  source_item_id: number;
  derived_item_id: number;
  transform_type: string;
  prompt_profile: string;
  created_at: string;
  derived_item?: ContentOsItem;
};

export function postContentOsRepurpose(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { targets: ContentOsRepurposeTarget[]; optimize_hooks?: boolean },
): Promise<{ ok: boolean; derived_items: ContentOsItem[]; derivations: ContentOsDerivation[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/repurpose`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsDerivations(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ derivations: ContentOsDerivation[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/derivations`);
}

export function postContentOsBridgeSeo(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; item: ContentOsItem; seo_content_id: number; href: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/seo`, { method: 'POST', body: '{}' });
}

export function fetchContentOsBridgeSeoStatus(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ linked: boolean; seo_content_id: number | null; workflow_status: string | null; href: string | null }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/seo/status`);
}

export function postContentOsBridgeEmail(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { client_id: string; template_id?: string; segment_id?: string; email_type?: string },
): Promise<{ ok: boolean; item: ContentOsItem; campaign_id: string; href: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/email`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsBridgeEmailStatus(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ linked: boolean; campaign_id: string | null; status: string | null; href: string | null }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/email/status`);
}

export function patchContentOsProduction(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: Record<string, unknown>,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/production`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function postContentOsProductionDone(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/production/done`, { method: 'POST', body: '{}' });
}

export function postContentOsExportDesignBrief(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/export/brief-design`, { method: 'POST', body: '{}' });
}

export function postContentOsExportScript(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/export/script`, { method: 'POST', body: '{}' });
}

export function getEmBridgeHref(item: ContentOsItem): string | null {
  const ref = item.brief_json?.em_bridge as { href?: string; campaign_id?: string } | undefined;
  if (ref?.href) return ref.href;
  if (ref?.campaign_id) return `/email/campaigns/${ref.campaign_id}`;
  return null;
}
