import { API_BASE } from '@/lib/api';
import type { ContentOsCalendarSlot, ContentOsItem, ContentOsReviewQueueItem } from '@/lib/content-os-api';

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

export type PortfolioCommandCenter = {
  throughput_week: number;
  completed_week: number;
  wip: number;
  sla_at_risk: number;
  sla_breached: number;
  first_pass_pct: number | null;
  capacity_pct: number | null;
  blocked: number;
  risk_queue: PortfolioRiskQueueItem[];
  insight?: PortfolioCommandCenterInsight | null;
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
): Promise<ConvertedPortfolioRequest> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/requests/${requestId}/convert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
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

export type PortfolioPublicationList = {
  slots: ContentOsCalendarSlot[];
};

export async function fetchPortfolioPublications(token: string): Promise<PortfolioPublicationList> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/publications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { slots: [] };
  const body = (await res.json()) as PortfolioPublicationList | null;
  return { slots: Array.isArray(body?.slots) ? body.slots : [] };
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
