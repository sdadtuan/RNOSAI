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

export type CpProject = CpProjectSummary & {
  industry: string | null;
  objective: string | null;
  start_at: string | null;
  cost_center: string | null;
  tags: string[];
  member_staff_ids?: number[];
  created_at?: string;
  updated_at?: string;
};

export type CpProjectInput = {
  name: string;
  agency_client_id: string;
  owner_staff_id: number;
  lifecycle_id?: string | null;
  industry?: string | null;
  objective?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  status?: string;
  credit_budget?: number | null;
  cost_center?: string | null;
  tags?: string[];
  member_staff_ids?: number[];
};

export type CpBrief = {
  id: string;
  project_id: string;
  version: number;
  body_json: unknown;
  approval_status: string;
  created_by: number;
  created_at?: string;
};

export type CpDeliverable = {
  id: string;
  project_id: string;
  type: string;
  status: string;
  owner_staff_id: number | null;
  due_at: string | null;
  priority: string;
  video_draft_id: string | null;
  video_version_id: string | null;
  vd_project_id: string | null;
  content_item_id: string | null;
};

export type CpTask = {
  id: string;
  project_id: string;
  title: string;
  assignee_id: number | null;
  due_at: string | null;
  priority: string;
  status: string;
  depends_on_id: string | null;
  am_task_id: string | null;
  csd_ticket_id: string | null;
};

export type CpMilestone = {
  id: string;
  project_id: string;
  title: string;
  due_at: string | null;
  owner_id?: number | null;
  depends_on_id?: string | null;
  status?: string | null;
};

export const CP_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'application/pdf',
] as const;

export type CpAssetMime = (typeof CP_MIME_ALLOWLIST)[number];

export type CpAsset = {
  id: string;
  agency_client_id: string;
  project_id: string | null;
  owner_staff_id: number;
  filename: string;
  mime: string;
  state: string;
  bytes: number | string | null;
  hash: string | null;
  license_type?: string | null;
  owner_name?: string | null;
  effective_on?: string | null;
  expiry_on?: string | null;
  territory?: string[];
  channels?: string[];
  restriction?: string | null;
  model_release?: boolean | null;
  talent_release?: boolean | null;
  proof_asset_id?: string | null;
  rights_status?: 'ok' | 'warn' | 'block' | null;
  created_at: string;
};

export type CpCreateAssetInput = {
  agency_client_id: string;
  mime: string;
  filename: string;
  project_id?: string | null;
};

export type CpAssetRightsInput = {
  license_type?: string | null;
  owner_name?: string | null;
  effective_on?: string | null;
  expiry_on?: string | null;
  territory?: string[] | null;
  channels?: string[] | null;
  restriction?: string | null;
  model_release?: boolean | null;
  talent_release?: boolean | null;
  proof_asset_id?: string | null;
};

export type CpAssetUsage = {
  asset_version_id: string;
  n: number;
  storage_key: string;
  mime: string;
  bytes: number | string | null;
  object_type: string | null;
  object_id: string | null;
};

export type CpBrandScopeType = 'tenant' | 'client' | 'project';

export type CpBrandKit = {
  id: string;
  tenant_id: string;
  scope_type: CpBrandScopeType;
  agency_client_id: string | null;
  project_id: string | null;
  name: string;
  status: string | null;
  latest_version?: number | string | null;
};

export type CpBrandKitInput = {
  name: string;
  scope_type: CpBrandScopeType;
  agency_client_id?: string | null;
  project_id?: string | null;
};

export type CpBrandPayload = {
  logos: {
    primary: string;
    light: string;
    mark: string;
    icon: string;
  };
  palette: string[];
  typography: {
    font_family: string;
    heading_weight: string;
    body_weight: string;
  };
  cta: {
    label: string;
    url: string;
  };
  disclaimer: {
    text: string;
    channels: string;
  };
  motion: {
    intro: string;
    outro: string;
    caption_style: string;
    watermark: string;
  };
  audio: {
    sound_logo: string;
    voice_style: string;
    music_style: string;
  };
};

export type CpBrandVersion = {
  id: string;
  kit_id: string;
  n: number;
  payload_json: Record<string, unknown>;
  approved_by: number | null;
  approved_at: string | null;
};

export function buildBrandVersionPayload(
  _previous: CpBrandPayload | null,
  draft: CpBrandPayload,
): CpBrandPayload {
  return {
    logos: { ...draft.logos },
    palette: [...draft.palette],
    typography: { ...draft.typography },
    cta: { ...draft.cta },
    disclaimer: { ...draft.disclaimer },
    motion: { ...draft.motion },
    audio: { ...draft.audio },
  };
}

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
  query: CpOverviewQuery & { status?: string; q?: string; cursor?: string } = {},
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

export function createCpProject(token: string, input: CpProjectInput) {
  return cpFetch<CpProject>(token, '/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCpProject(token: string, projectId: string) {
  return cpFetch<CpProject>(token, `/projects/${encodeURIComponent(projectId)}`);
}

export function patchCpProject(
  token: string,
  projectId: string,
  input: Partial<Omit<CpProjectInput, 'agency_client_id'>>,
) {
  return cpFetch<CpProject>(token, `/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function closeCpProject(token: string, projectId: string, archivePending = false) {
  return cpFetch<CpProject>(token, `/projects/${encodeURIComponent(projectId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ archive_pending: archivePending }),
  });
}

function cpProjectCollectionPath(projectId: string, collection: string): string {
  return `/projects/${encodeURIComponent(projectId)}/${collection}`;
}

export function listCpProjectBriefs(token: string, projectId: string) {
  return cpFetch<{ items: CpBrief[] }>(token, cpProjectCollectionPath(projectId, 'briefs'));
}

export function createCpProjectBrief(
  token: string,
  projectId: string,
  input: { body_json: unknown; approval_status?: string },
) {
  return cpFetch<CpBrief>(token, cpProjectCollectionPath(projectId, 'briefs'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCpProjectDeliverables(token: string, projectId: string) {
  return cpFetch<{ items: CpDeliverable[] }>(
    token,
    cpProjectCollectionPath(projectId, 'deliverables'),
  );
}

export function createCpProjectDeliverable(
  token: string,
  projectId: string,
  input: Partial<Omit<CpDeliverable, 'id' | 'project_id'>>,
) {
  return cpFetch<CpDeliverable>(token, cpProjectCollectionPath(projectId, 'deliverables'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCpProjectTasks(token: string, projectId: string) {
  return cpFetch<{ items: CpTask[] }>(token, cpProjectCollectionPath(projectId, 'tasks'));
}

export function createCpProjectTask(
  token: string,
  projectId: string,
  input: Partial<Omit<CpTask, 'id' | 'project_id'>> & { title: string },
) {
  return cpFetch<CpTask>(token, cpProjectCollectionPath(projectId, 'tasks'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCpAssets(token: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpAsset[] }>(
    token,
    cpQueryPath('/assets', { scope }),
  );
}

export function createCpAsset(token: string, input: CpCreateAssetInput) {
  return cpFetch<CpAsset>(token, '/assets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCpAsset(token: string, assetId: string, scope: CpScope = 'me') {
  return cpFetch<CpAsset>(
    token,
    cpQueryPath(`/assets/${encodeURIComponent(assetId)}`, { scope }),
  );
}

export function getCpAssetUsage(token: string, assetId: string, scope: CpScope = 'me') {
  return cpFetch<{ asset_id: string; usages: CpAssetUsage[] }>(
    token,
    cpQueryPath(`/assets/${encodeURIComponent(assetId)}/usage`, { scope }),
  );
}

export function setCpAssetRights(
  token: string,
  assetId: string,
  input: CpAssetRightsInput,
) {
  return cpFetch<CpAssetRightsInput & {
    asset_id: string;
    rights_status: 'ok' | 'warn' | 'block' | null;
  }>(token, `/assets/${encodeURIComponent(assetId)}/rights`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listKits(token: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpBrandKit[] }>(
    token,
    cpQueryPath('/brand-kits', { scope }),
  );
}

export function createKit(
  token: string,
  input: CpBrandKitInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpBrandKit>(token, cpQueryPath('/brand-kits', { scope }), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getKit(token: string, kitId: string, scope: CpScope = 'me') {
  return cpFetch<CpBrandKit>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}`, { scope }),
  );
}

export function listVersions(token: string, kitId: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpBrandVersion[] }>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}/versions`, { scope }),
  );
}

export function saveVersion(
  token: string,
  kitId: string,
  payload: CpBrandPayload,
  scope: CpScope = 'me',
) {
  return cpFetch<CpBrandVersion>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}/versions`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function finalizeCpAsset(
  token: string,
  assetId: string,
  input: { bytes: number; hash: string },
) {
  return cpFetch<CpAsset>(token, `/assets/${encodeURIComponent(assetId)}/finalize`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
