import { API_BASE, ApiError, parseJson } from '@/lib/api';

export type CpScope = 'me' | 'team' | 'all';

export type CpOverviewQuery = {
  from?: string;
  to?: string;
  client?: string;
  lifecycle?: string;
  owner?: string;
  scope?: CpScope;
};

export type CpOverviewKpis = {
  videos_created: number | null;
  videos_approved: number | null;
  render_success_rate: number | null;
  render_avg_duration_sec: number | null;
  credits_used: number | null;
  credits_remaining: number | null;
  assets_expiring: number | null;
  tasks_overdue: number | null;
};

export type CpOverviewAction = {
  kind: string;
  severity: string;
  title: string;
  resource_type: string;
  resource_id: string | null;
  owner_staff_id: number | null;
  sla_at: string | null;
  href: string;
};

export type CpOverviewHealth = {
  queue_depth: number | null;
  slots: { used: number | null; max: number | null };
  providers: Array<{
    id: string;
    success_pct: number | null;
    p95_sec: number | null;
  }>;
};

export type CpActivity = {
  id: string;
  actor_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  payload: unknown;
  created_at: string;
};

export type CpProjectSummary = {
  id: string;
  name: string;
  agency_client_id: string;
  lifecycle_id: string | null;
  owner_staff_id: number;
  status: string;
  due_at: string | null;
  credit_budget: number | null;
};

export type CpMilestone = {
  id: string;
  project_id: string;
  title: string;
  due_at: string | null;
  status?: string | null;
};

function cpQueryPath(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function cpFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_BASE}/api/crm/cp${suffix}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'CP request failed', res.status);
  }
  return body;
}

export function getOverviewKpis(token: string, query: CpOverviewQuery = {}) {
  return cpFetch<{ last_updated: string; kpis: CpOverviewKpis }>(
    token,
    cpQueryPath('/overview/kpis', query),
  );
}

export function getOverviewActions(token: string, query: CpOverviewQuery = {}) {
  return cpFetch<CpOverviewAction[]>(
    token,
    cpQueryPath('/overview/actions', query),
  );
}

export function getOverviewHealth(token: string, query: CpOverviewQuery = {}) {
  return cpFetch<CpOverviewHealth>(
    token,
    cpQueryPath('/overview/health', query),
  );
}

export function listActivity(
  token: string,
  query: CpOverviewQuery & { cursor?: string } = {},
) {
  return cpFetch<{ items: CpActivity[]; next_cursor: string | null }>(
    token,
    cpQueryPath('/activity', query),
  );
}

export function listCpProjects(
  token: string,
  query: CpOverviewQuery & { status?: string } = {},
) {
  return cpFetch<{ items: CpProjectSummary[]; next_cursor: string | null }>(
    token,
    cpQueryPath('/projects', query),
  );
}

export function listCpProjectMilestones(token: string, projectId: string) {
  return cpFetch<{ items: CpMilestone[] }>(
    token,
    `/projects/${encodeURIComponent(projectId)}/milestones`,
  );
}
