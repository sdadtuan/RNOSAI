import { API_BASE } from '@/lib/api';

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

export async function fetchCommandCenter(token: string): Promise<PortfolioCommandCenter> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/command-center`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được Command Center');
  return res.json();
}

export type PortfolioContentRequest = {
  id: number;
  lifecycle_id: number;
  display_code: string;
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
