import { API_BASE, ApiError } from '@/lib/api';
import type { ContentOsCalendarSlot, ContentOsItem, ContentOsReviewQueueItem } from '@/lib/content-os-api';
import { readDamListResult, type DamListResult, type DamRightsMetadata } from './cmkte-dam';
import { readDirectSocialPublish, readSsoEnforced } from './cmkte-settings';
import type { ChannelHealthStatus } from './cmkte-win-publish';

export type PortfolioRiskQueueItem = {
  item_id: number;
  lifecycle_id: number;
  content_code: string | null;
  title: string;
  client_label: string | null;
  risk_signal: string;
  owner_label: string | null;
  sla_remaining_h: number | null;
  recommended_action: string;
};

export type PortfolioCommandCenterInsight = {
  status: string;
  title?: string | null;
  body?: string | null;
};

export type TodayPublishRow = {
  item_id: number;
  display_code: string;
  page_name: string;
  gate: 'Pass' | 'Warning' | 'Blocked';
  blockers: number;
  health: 'Manual' | 'Connected' | 'TokenExpired';
};

export type PortfolioCommandCenter = {
  throughput_week: number;
  completed_week: number;
  wip: number;
  sla_at_risk: number;
  sla_breached: number;
  first_pass_pct: number | null;
  capacity_pct: number | null;
  capacity_band?: 'ok' | 'warning' | 'at_risk' | 'overloaded' | null;
  blocked: number;
  risk_queue: PortfolioRiskQueueItem[];
  insight?: PortfolioCommandCenterInsight | null;
  today_publish?: TodayPublishRow[];
};

export async function fetchCommandCenter(
  token: string,
  lifecycleHint?: number,
): Promise<PortfolioCommandCenter> {
  const qs = lifecycleHint && lifecycleHint > 0 ? `?lifecycle=${lifecycleHint}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/command-center${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được Command Center');
  return res.json();
}

export function filterCommandCenter(
  data: PortfolioCommandCenter,
  lifecycleId?: number,
): PortfolioCommandCenter {
  if (!(lifecycleId && lifecycleId > 0)) return data;
  return {
    ...data,
    risk_queue: data.risk_queue.filter((row) => row.lifecycle_id === lifecycleId),
  };
}

export type PortfolioContentRequest = {
  id: number;
  lifecycle_id: number;
  display_code: string;
  kind?: 'request' | 'idea';
  source: string;
  requester_email: string;
  client_label: string;
  brand_label: string;
  deliverable_ask: string;
  objective: string;
  due_at: string | null;
  priority: string;
  risk_level: string;
  completeness: number;
  effort_h: number | null;
  tier: string | null;
  triage_status: string;
  idea_id: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PortfolioRequestList = {
  items: PortfolioContentRequest[];
};

export type ConvertedPortfolioRequest = {
  request: PortfolioContentRequest;
  item: { id: number; display_code?: string };
};

export type LifecycleIdeaRow = {
  id: number;
  lifecycle_id: number;
  title: string;
  status: string;
  source?: string;
  target_goal?: string;
  created_at?: string;
};

export type IntakeRow = {
  key: string;
  kind: 'request' | 'idea';
  requestId: number | null;
  code: string;
  deliverable: string;
  context: string;
  completeness: string | null;
  effort: string;
  risk: string;
  source: string;
  triageStatus: string;
  canConvert: boolean;
};

function isSyntheticIdeaRow(row: PortfolioContentRequest): boolean {
  if (row.kind === 'idea') return true;
  if (row.kind === 'request') return false;
  return row.display_code.startsWith('IDEA-');
}

export function mapIntakeRows(
  items: PortfolioContentRequest[],
  ideas: LifecycleIdeaRow[] = [],
): IntakeRow[] {
  const fromItems = items.map((row) => {
    const isIdea = isSyntheticIdeaRow(row);
    return {
      key: isIdea ? `idea-${row.idea_id ?? row.id}` : `req-${row.id}`,
      kind: isIdea ? ('idea' as const) : ('request' as const),
      requestId: isIdea ? null : row.id,
      code: row.display_code || (isIdea ? `IDEA-${row.idea_id ?? row.id}` : `CR-${row.id}`),
      deliverable: row.deliverable_ask,
      context: isIdea
        ? row.objective?.trim() || '—'
        : [row.client_label, row.brand_label, row.source].filter(Boolean).join(' / ') || '—',
      completeness: !isIdea && Number.isFinite(row.completeness) ? `${row.completeness}% complete` : null,
      effort: isIdea
        ? '—'
        : [row.effort_h != null ? `${row.effort_h}h` : null, row.tier || row.priority]
            .filter(Boolean)
            .join(' · ') || '—',
      risk: isIdea ? '—' : row.risk_level || '—',
      source: row.source,
      triageStatus: row.triage_status,
      canConvert: !isIdea && row.triage_status === 'Accepted',
    };
  });
  const seenIdeaIds = new Set(
    items.filter(isSyntheticIdeaRow).map((row) => row.idea_id ?? row.id),
  );
  const fromIdeas = ideas
    .filter((idea) => idea.status !== 'converted' && idea.status !== 'archived')
    .filter((idea) => !seenIdeaIds.has(idea.id))
    .map((idea) => ({
      key: `idea-${idea.id}`,
      kind: 'idea' as const,
      requestId: null,
      code: `IDEA-${idea.id}`,
      deliverable: idea.title,
      context: idea.target_goal?.trim() || '—',
      completeness: null,
      effort: '—',
      risk: '—',
      source: 'idea',
      triageStatus: idea.status,
      canConvert: false,
    }));
  return [...fromItems, ...fromIdeas];
}

export function filterPortfolioRequests(
  items: PortfolioContentRequest[],
  lifecycleId?: number,
): PortfolioContentRequest[] {
  if (!(lifecycleId && lifecycleId > 0)) return items;
  return items.filter((row) => row.lifecycle_id === lifecycleId);
}

export async function fetchPortfolioRequests(token: string): Promise<PortfolioRequestList> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { items: [] };
  const body = (await res.json()) as PortfolioRequestList | null;
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export async function convertPortfolioRequest(
  token: string,
  requestId: number,
  body: { brand_id: string; locale: string },
): Promise<ConvertedPortfolioRequest> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/requests/${requestId}/convert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_id: String(body.brand_id ?? '').trim(),
      locale: String(body.locale ?? '').trim(),
    }),
  });
  if (!res.ok) throw new Error('Không chuyển được request thành content item.');
  return res.json();
}

export type PortfolioApprovalItem = ContentOsReviewQueueItem;

export type PortfolioApprovalList = {
  items: PortfolioApprovalItem[];
};

export async function fetchPortfolioApprovals(token: string): Promise<PortfolioApprovalList> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/approvals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { items: [] };
  const body = (await res.json()) as PortfolioApprovalList | null;
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export type PortfolioBatchApproveResult = {
  ok: number[];
  failed: Array<{ id: number; error: string }>;
};

export async function postPortfolioApprovalsBatch(
  token: string,
  itemIds: number[],
  step?: string,
): Promise<PortfolioBatchApproveResult> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/approvals/batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ item_ids: itemIds, ...(step ? { step } : {}) }),
  });
  const body = (await res.json().catch(() => null)) as
    | (PortfolioBatchApproveResult & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(body?.error ?? 'batch_approve_failed');
  }
  return {
    ok: Array.isArray(body?.ok) ? body.ok : [],
    failed: Array.isArray(body?.failed) ? body.failed : [],
  };
}

export type PortfolioPublicationHealth = {
  channel: string;
  status: string;
  expires_at?: string;
};

export type PortfolioPublicationList = {
  slots: ContentOsCalendarSlot[];
  channel_health?: PortfolioPublicationHealth[];
};

export async function fetchPortfolioPublications(token: string): Promise<PortfolioPublicationList> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/publications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { slots: [] };
  const body = (await res.json()) as PortfolioPublicationList | null;
  return {
    slots: Array.isArray(body?.slots) ? body.slots : [],
    ...(Array.isArray(body?.channel_health) ? { channel_health: body.channel_health } : {}),
  };
}

export async function fetchPortfolioItem(
  token: string,
  itemId: number,
  lifecycleHint?: number,
): Promise<ContentOsItem> {
  const qs = lifecycleHint && lifecycleHint > 0 ? `?lifecycle=${lifecycleHint}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/items/${itemId}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('item_not_found');
  return res.json();
}

export type PortfolioInsight = {
  id: number;
  lifecycle_id: number;
  pattern: string;
  evidence: string;
  confidence: number | null;
  status: 'Draft' | 'Approved' | 'Rejected' | 'Outdated' | 'Superseded';
  scope_json?: Record<string, unknown>;
  expires_at: string | null;
  created_at?: string;
};

export type PortfolioInsightList = {
  items: PortfolioInsight[];
};

export async function fetchPortfolioInsights(
  token: string,
  lifecycleHint?: number,
): Promise<PortfolioInsightList> {
  const qs = lifecycleHint && lifecycleHint > 0 ? `?lifecycle=${lifecycleHint}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/insights${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được insight');
  const body = (await res.json()) as PortfolioInsightList | null;
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export type PortfolioSlaEvent = {
  id: number;
  item_id: number;
  task_id: string;
  threshold: number;
  action: string;
  am_staff_id: number | null;
  created_at: string;
};

export type PortfolioSlaEventList = {
  items: PortfolioSlaEvent[];
};

export async function fetchPortfolioSlaEvents(
  token: string,
  filters?: { itemId?: number; amStaffId?: number },
): Promise<PortfolioSlaEventList> {
  const params = new URLSearchParams();
  if (filters?.itemId && filters.itemId > 0) params.set('item_id', String(filters.itemId));
  if (filters?.amStaffId && filters.amStaffId > 0) params.set('am_staff_id', String(filters.amStaffId));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/sla-events${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { items: [] };
  const body = (await res.json()) as PortfolioSlaEventList | null;
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export type PortfolioGlossary = {
  id: number;
  lifecycle_id: number;
  brand_id: string;
  term: string;
  locale: string;
  preferred?: string;
  status: 'Draft' | 'Approved' | 'Rejected';
  expires_at: string | null;
  created_at?: string;
};

export type PortfolioGlossaryList = {
  items: PortfolioGlossary[];
};

export async function fetchPortfolioGlossary(
  token: string,
  lifecycleHint?: number,
): Promise<PortfolioGlossaryList> {
  const qs = lifecycleHint && lifecycleHint > 0 ? `?lifecycle=${lifecycleHint}` : '';
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/glossary${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được glossary');
  const body = (await res.json()) as PortfolioGlossaryList | null;
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export async function createPortfolioGlossary(
  token: string,
  body: { term: string; locale: string; brand_id: string; lifecycle_id: number; preferred?: string },
): Promise<PortfolioGlossary> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/glossary`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? 'glossary_create_failed');
  }
  return res.json();
}

export async function approvePortfolioGlossary(token: string, glossaryId: number): Promise<PortfolioGlossary> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/glossary/${glossaryId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'glossary_approve_failed');
  }
  return res.json();
}

export async function approvePortfolioInsight(token: string, insightId: number): Promise<PortfolioInsight> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/insights/${insightId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'insight_approve_failed');
  }
  return res.json();
}

export type PortfolioSettings = {
  direct_social_publish: boolean;
  sso_enforced: boolean;
};

export async function fetchDamAssets(token: string, collection?: string): Promise<DamListResult> {
  const qs = collection?.trim() ? `?collection=${encodeURIComponent(collection.trim())}` : '';
  try {
    const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/dam${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return readDamListResult(body, 'dam_unavailable');
    }
    return readDamListResult(body);
  } catch {
    return { items: [], error: 'dam_unavailable' };
  }
}

export type DamBindBody = { dam_id: string; url: string; rights?: DamRightsMetadata | null };

export async function bindDamAsset(
  token: string,
  itemId: number,
  body: DamBindBody,
): Promise<{ media_json?: { dam_refs?: Array<{ dam_id: string; url: string }> } }> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/items/${itemId}/dam-bind`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dam_id: body.dam_id,
      url: body.url,
      ...(body.rights != null ? { rights: body.rights } : {}),
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? 'dam_unavailable');
  }
  return res.json();
}

export async function fetchPortfolioAuditExport(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/audit/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(err?.error ?? err?.message ?? 'audit_export_failed');
  }
  return res.text();
}

export async function fetchPortfolioSettings(token: string): Promise<PortfolioSettings> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(err?.error ?? err?.message ?? 'settings_fetch_failed');
  }
  const body = (await res.json().catch(() => null)) as PortfolioSettings | null;
  return {
    direct_social_publish: readDirectSocialPublish(body),
    sso_enforced: readSsoEnforced(body),
  };
}

export async function patchPortfolioLegalHold(
  token: string,
  itemId: number,
  body: { legal_hold: boolean; reason: string },
): Promise<{ id: number; legal_hold: boolean; legal_hold_set_by: string | null }> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/items/${itemId}/legal-hold`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ legal_hold: body.legal_hold === true, reason: String(body.reason ?? '') }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(err?.error ?? 'legal_hold_patch_failed', res.status);
  }
  return res.json();
}

export async function patchPortfolioSettings(
  token: string,
  body: { direct_social_publish: boolean },
): Promise<PortfolioSettings> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/settings`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ direct_social_publish: body.direct_social_publish === true }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? 'settings_patch_failed');
  }
  const saved = (await res.json().catch(() => null)) as PortfolioSettings | null;
  return {
    direct_social_publish: readDirectSocialPublish(saved),
    sso_enforced: readSsoEnforced(saved),
  };
}

export type ChannelAccountPublic = {
  id: number;
  channel: string;
  display_name: string;
  account_ref: string;
  health: { status: ChannelHealthStatus; expires_at?: string };
  connector_id?: number | null;
};

export type ExecuteBody = {
  item_id: number;
  channel_account_id: number;
  snapshot_id: string;
  confirm: true;
  client_request_id: string;
};

export type ExecuteAccepted = {
  queued: true;
  client_request_id: string;
  execute_id: number;
  replayed?: true;
  post_id?: string | null;
  permalink?: string | null;
};

function assertNoSecretTokens(data: unknown): void {
  if (/access_token|refresh_token/.test(JSON.stringify(data))) {
    throw new Error('secret_token_in_payload');
  }
}

async function readPortfolioJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? body?.message ?? 'request_failed', res.status);
  }
  assertNoSecretTokens(body);
  return body as T;
}

export function facebookOAuthStartUrl(): string {
  return `${API_BASE}/api/crm/content-os/portfolio/connectors/facebook/oauth/start.json`;
}

export function isSafeFacebookDialogRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'facebook.com' && host !== 'www.facebook.com') return false;
    if (url.includes('access_token')) return false;
    return parsed.pathname.includes('/dialog/oauth');
  } catch {
    return false;
  }
}

export async function startFacebookOAuth(token: string): Promise<{ redirect: string }> {
  const res = await fetch(facebookOAuthStartUrl(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await readPortfolioJson<{ redirect?: string }>(res);
  return { redirect: String(body.redirect ?? '') };
}

export async function fetchChannelAccounts(token: string): Promise<{ items: ChannelAccountPublic[] }> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/channel-accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readPortfolioJson<{ items?: ChannelAccountPublic[] }>(res);
  return { items: Array.isArray(body?.items) ? body.items : [] };
}

export async function postConnectorDisconnect(token: string, id: number): Promise<{ status: 'off' }> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/connectors/${id}/disconnect`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  await readPortfolioJson<{ status?: 'off' }>(res);
  return { status: 'off' };
}

export async function postPublicationExecute(token: string, body: ExecuteBody): Promise<ExecuteAccepted> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/publications/execute`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readPortfolioJson<ExecuteAccepted>(res);
}

export async function fetchLifecycleIdeas(
  token: string,
  lifecycleId: number,
): Promise<LifecycleIdeaRow[]> {
  if (!(lifecycleId > 0)) return [];
  const res = await fetch(
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/content-marketing/ideas`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { ideas?: LifecycleIdeaRow[] } | null;
  return Array.isArray(body?.ideas) ? body.ideas : [];
}
