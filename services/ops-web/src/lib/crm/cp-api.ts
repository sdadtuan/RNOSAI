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

export type CpAssetFileVersion = {
  id: string;
  n: number;
  storage_key: string;
  mime: string;
  bytes: number | string | null;
};

export type CpReplaceAssetInput = {
  mime: string;
  storage_key: string;
  bytes: number;
  filename?: string | null;
  hash?: string | null;
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

export type CpVideoInputMode = 'prompt' | 'script' | 'url' | 'template';

export type CpVideoDraftInput = {
  project_id?: string;
  deliverable_id?: string | null;
  name?: string;
  input_mode?: CpVideoInputMode;
  prompt?: string | null;
  script_json?: unknown;
  config_json?: Record<string, unknown>;
  brand_kit_version_id?: string | null;
};

export type CpVideoDraft = CpVideoDraftInput & {
  id: string;
  project_id: string;
  agency_client_id?: string | null;
  revision?: number | string | null;
  autosaved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CpScene = {
  draft_id?: string;
  idx: number;
  title?: string | null;
  t_start?: number | null;
  t_end?: number | null;
  visual?: string | null;
  vo?: string | null;
  overlay?: string | null;
  locked?: boolean;
  qc?: string | null;
};

export type CpSceneWrite = {
  scenes: Array<Partial<CpScene> & { idx: number }>;
};

export type CpTimelineMusic = {
  source?: string | null;
  t_start?: number | null;
  t_end?: number | null;
  volume?: number | null;
};

export type CpTimelinePatch = {
  scenes?: Array<Partial<CpScene> & { idx: number }>;
  music?: CpTimelineMusic | null;
};

export type CpTimelineResult = {
  revision: number | string;
  scenes: CpScene[];
  music?: CpTimelineMusic | null;
};

export type CpQcResult = 'passed' | 'warning' | 'blocked';

export type CpQcCheckReport = {
  result: CpQcResult;
  reason?: string | null;
};

export type CpQcReport = {
  overall: CpQcResult;
  checks: Record<string, CpQcCheckReport>;
};

export type CpQcFacts = {
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  has_audio?: boolean | null;
  safe_area_ok?: boolean | null;
  caption_overflow?: boolean | null;
  logo_present?: boolean | null;
  cta_present?: boolean | null;
  disclaimer_present?: boolean | null;
  loudness_lufs?: number | null;
  black_frozen?: boolean | null;
  moderation?: string | boolean | null;
};

export type CpVideoVersion = {
  id: string;
  draft_id: string;
  draft_name?: string | null;
  project_id?: string | null;
  version_n: number | string;
  snapshot_json: unknown;
  qc_status?: string | null;
  qc_json?: CpQcReport | unknown;
  approval_status: string;
  immutable: boolean;
  output_uri?: string | null;
  pricing_version?: string | null;
  brand_kit_version_id?: string | null;
};

export type CpVideoComment = {
  id: string;
  object_type: string;
  object_id: string;
  timecode_ms: number | null;
  body: string;
  status: string;
  mention_ids: number[];
  created_by: number;
  created_at?: string | null;
};

export type CpVideoCommentInput = {
  body: string;
  timecode_ms?: number | null;
  mention_ids?: number[];
  status?: string;
};

export type CpVideoApprovalInput = {
  status: string;
  decision?: string | null;
  reason?: string | null;
};

export type CpVersionDiffField<T = unknown> = {
  a: T;
  b: T;
  changed: boolean;
};

export type CpVersionCompare = {
  metadata: CpVersionDiffField;
  script: CpVersionDiffField;
  kit_id: CpVersionDiffField<string | null>;
  asset_ids: CpVersionDiffField<string[]>;
  cost: CpVersionDiffField;
};

export type CpRenderJob = {
  id: string;
  job_id?: string;
  draft_id: string;
  parent_job_id?: string | null;
  state: string;
  stage?: string | null;
  progress?: number | string | null;
  provider?: string | null;
  estimate?: number | string | null;
  idempotency_key?: string | null;
  correlation_id?: string | null;
  stage_log_json?: unknown;
  attempt?: number | string | null;
  output_uri?: string | null;
  error?: string | null;
  error_json?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export const CP_MODEL_FIELDS = [
  'id',
  'max_res',
  'max_duration_sec',
  'cap_per_job',
  'region',
  'fallback_id',
] as const;

export type CpModelSetting = Partial<
  Record<(typeof CP_MODEL_FIELDS)[number], string | number | null>
> & Record<string, unknown>;

export type CpSettings = {
  locale: string | null;
  timezone: string | null;
  default_brand_kit_id: string | null;
  retention_days: number | null;
  signed_url_ttl_min: number | null;
  restore_days: number | null;
  legal_hold: boolean | null;
  soft_alert_pct: number | null;
  hard_cap_pct: number | null;
  high_cost_threshold: number | null;
  concurrent_slots: number | null;
  watermark_draft: boolean | null;
  ai_enabled: boolean | null;
  publish_native: boolean | null;
  models_json: CpModelSetting[];
  policy_json: Record<string, unknown>;
  updated_at?: string | null;
  updated_by_staff_id?: number | null;
};

export type CpSettingsPatch = Partial<Omit<
  CpSettings,
  'updated_at' | 'updated_by_staff_id'
>>;

export type CpCreditGrantInput = {
  agency_client_id: string;
  amount: number;
  cost_center?: string | null;
};

export class CpApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly reasons: string[] = [],
  ) {
    super(message, status);
    this.name = 'CpApiError';
  }
}

export function formatCpApiError(error: unknown, fallback = 'CP request failed'): string {
  if (error instanceof CpApiError && error.reasons.length) {
    return `${error.message}: ${error.reasons.join(', ')}`;
  }
  return error instanceof Error ? error.message : fallback;
}

export function parseCpScriptEditor(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

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

export function buildCpSettingsPatch(input: CpSettingsPatch): CpSettingsPatch {
  const output = { ...input };
  if (Object.prototype.hasOwnProperty.call(input, 'models_json')) {
    output.models_json = projectCpModels(input.models_json);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'policy_json')) {
    output.policy_json = stripCpPolicySecrets(input.policy_json);
  }
  return output;
}

export function projectCpSettingsForUi(settings: CpSettings | null): CpSettings | null {
  if (!settings) return null;
  return {
    ...settings,
    models_json: projectCpModels(settings.models_json),
    policy_json: stripCpPolicySecrets(settings.policy_json),
  };
}

function projectCpModels(value: unknown): CpModelSetting[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((model): model is Record<string, unknown> => (
      model !== null && typeof model === 'object' && !Array.isArray(model)
    ))
    .map((model) => Object.fromEntries(
      CP_MODEL_FIELDS
        .filter((field) => Object.prototype.hasOwnProperty.call(model, field))
        .map((field) => [field, model[field]]),
    ));
}

const CP_POLICY_SECRET_KEY = /secret|token|password|credential|api_key/i;

function stripCpPolicySecrets(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !CP_POLICY_SECRET_KEY.test(key))
      .map(([key, item]) => [key, stripCpPolicyValue(item)]),
  );
}

function stripCpPolicyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCpPolicyValue);
  if (value !== null && typeof value === 'object') return stripCpPolicySecrets(value);
  return value;
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
  const body = await parseJson<T & {
    error?: string;
    message?: string;
    reasons?: unknown;
  }>(res);
  if (!res.ok) {
    const reasons = Array.isArray(body.reasons)
      ? body.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [];
    throw new CpApiError(
      body.error ?? body.message ?? 'CP request failed',
      res.status,
      reasons,
    );
  }
  return body;
}

export function getOverviewKpis(token: string, query: CpOverviewQuery = {}) {
  return cpFetch<{ last_updated: string; kpis: CpOverviewKpis }>(
    token,
    cpQueryPath('/overview/kpis', query),
  );
}

export function getCpSettings(token: string) {
  return cpFetch<CpSettings | null>(token, '/settings');
}

export function patchCpSettings(token: string, input: CpSettingsPatch) {
  return cpFetch<CpSettings | null>(token, '/settings', {
    method: 'PATCH',
    body: JSON.stringify(buildCpSettingsPatch(input)),
  });
}

export function grantCpCredits(
  token: string,
  input: CpCreditGrantInput,
  idempotencyKey: string,
) {
  return cpFetch<Record<string, unknown>>(token, '/credits/grant', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
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

export function submitCpProjectCreative(
  token: string,
  projectId: string,
  versionId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<{ creative_id: string }>(
    token,
    cpQueryPath(`/projects/${encodeURIComponent(projectId)}/submit-creative`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify({ version_id: versionId }),
    },
  );
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
  return cpFetch<{ asset_id: string; versions?: CpAssetFileVersion[]; usages: CpAssetUsage[] }>(
    token,
    cpQueryPath(`/assets/${encodeURIComponent(assetId)}/usage`, { scope }),
  );
}

export function replaceCpAsset(token: string, assetId: string, input: CpReplaceAssetInput) {
  return cpFetch<CpAssetFileVersion>(token, `/assets/${encodeURIComponent(assetId)}/replace`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export type CpBrandEnforcement = 'block_render' | 'block_publish' | 'warning';

export type CpBrandRule = {
  id: string;
  kit_version_id: string;
  condition_json: Record<string, unknown>;
  action_json: Record<string, unknown>;
  enforcement: CpBrandEnforcement;
};

export type CpBrandRuleInput = {
  condition_json?: Record<string, unknown>;
  action_json?: Record<string, unknown>;
  enforcement: CpBrandEnforcement;
  n?: number;
};

export type CpBrandPreviewItem = {
  ratio: string;
  warnings: string[];
};

export type CpBrandPreviewInput = {
  overlay?: string | null;
  foreground?: string | null;
  background?: string | null;
  n?: number;
};

export function listBrandRules(token: string, kitId: string, scope: CpScope = 'me', n?: number) {
  return cpFetch<{ items: CpBrandRule[] }>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}/rules`, {
      scope,
      n: n == null ? undefined : String(n),
    }),
  );
}

export function createBrandRule(
  token: string,
  kitId: string,
  input: CpBrandRuleInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpBrandRule>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}/rules`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function previewBrandKit(
  token: string,
  kitId: string,
  input: CpBrandPreviewInput = {},
  scope: CpScope = 'me',
) {
  return cpFetch<{ items: CpBrandPreviewItem[] }>(
    token,
    cpQueryPath(`/brand-kits/${encodeURIComponent(kitId)}/preview`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function restoreBrandVersion(
  token: string,
  kitId: string,
  n: number,
  scope: CpScope = 'me',
) {
  return cpFetch<CpBrandVersion>(
    token,
    cpQueryPath(
      `/brand-kits/${encodeURIComponent(kitId)}/versions/${encodeURIComponent(String(n))}/restore`,
      { scope },
    ),
    { method: 'POST' },
  );
}

export type CpContentOsHandoffInput = {
  lifecycle_id: number;
  item_id?: number;
  name?: string;
  prompt?: string;
};

export type CpContentOsHandoffResult = {
  draft_id: string;
  href: string;
};

export function handoffContentOsToCreativeOs(
  token: string,
  input: CpContentOsHandoffInput,
) {
  return cpFetch<CpContentOsHandoffResult>(token, '/content-os/handoff', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCpVideos(token: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpVideoDraft[] }>(
    token,
    cpQueryPath('/videos', { scope }),
  );
}

export function createCpVideo(
  token: string,
  input: CpVideoDraftInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoDraft>(token, cpQueryPath('/videos', { scope }), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCpVideo(token: string, videoId: string, scope: CpScope = 'me') {
  return cpFetch<CpVideoDraft>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}`, { scope }),
  );
}

export function getCpVideoVersion(
  token: string,
  versionId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoVersion>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}`, { scope }),
  );
}

export function runCpVideoQc(
  token: string,
  versionId: string,
  facts: CpQcFacts = {},
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoVersion>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}/qc`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(facts),
    },
  );
}

export function exportCpVideoVersion(
  token: string,
  versionId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<{ id: string; output_uri: string | null; qc_status: string | null }>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}/export`, { scope }),
    { method: 'POST' },
  );
}

export function listCpVideoComments(
  token: string,
  versionId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<{ items: CpVideoComment[] }>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}/comments`, { scope }),
  );
}

export function createCpVideoComment(
  token: string,
  versionId: string,
  input: CpVideoCommentInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoComment>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}/comments`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function submitCpVideoApproval(
  token: string,
  versionId: string,
  input: CpVideoApprovalInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoVersion>(
    token,
    cpQueryPath(`/videos/versions/${encodeURIComponent(versionId)}/approvals`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function compareCpVideoVersions(
  token: string,
  versionId: string,
  otherId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVersionCompare>(
    token,
    cpQueryPath(
      `/videos/versions/${encodeURIComponent(versionId)}/compare/${encodeURIComponent(otherId)}`,
      { scope },
    ),
  );
}

export function listCpScenes(
  token: string,
  videoId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<{ items: CpScene[] }>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}/scenes`, { scope }),
  );
}

export function putCpScenes(
  token: string,
  videoId: string,
  input: CpSceneWrite,
  scope: CpScope = 'me',
) {
  return cpFetch<{ items: CpScene[] }>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}/scenes`, { scope }),
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function patchCpTimeline(
  token: string,
  videoId: string,
  input: CpTimelinePatch,
  scope: CpScope = 'me',
) {
  return cpFetch<CpTimelineResult>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}/timeline`, { scope }),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function regenerateCpScene(
  token: string,
  videoId: string,
  idx: number,
  scope: CpScope = 'me',
) {
  return cpFetch<CpScene>(
    token,
    cpQueryPath(
      `/videos/${encodeURIComponent(videoId)}/scenes/${encodeURIComponent(String(idx))}/regenerate`,
      { scope },
    ),
    { method: 'POST' },
  );
}

export function patchCpVideo(
  token: string,
  videoId: string,
  input: CpVideoDraftInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoDraft>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}`, { scope }),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function createCpRender(
  token: string,
  videoId: string,
  idempotencyKey: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpRenderJob>(
    token,
    cpQueryPath(`/videos/${encodeURIComponent(videoId)}/render`, { scope }),
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
}

export function listCpRenders(token: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpRenderJob[] }>(
    token,
    cpQueryPath('/renders', { scope }),
  );
}

export function getCpRender(token: string, renderId: string, scope: CpScope = 'me') {
  return cpFetch<CpRenderJob>(
    token,
    cpQueryPath(`/renders/${encodeURIComponent(renderId)}`, { scope }),
  );
}

export function retryCpRender(
  token: string,
  renderId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpRenderJob>(
    token,
    cpQueryPath(`/renders/${encodeURIComponent(renderId)}/retry`, { scope }),
    { method: 'POST' },
  );
}

export function cancelCpRender(
  token: string,
  renderId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpRenderJob>(
    token,
    cpQueryPath(`/renders/${encodeURIComponent(renderId)}/cancel`, { scope }),
    { method: 'POST' },
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

export type CpChannelProfile = {
  id: string;
  channel: string;
  rules_json: {
    ratio?: string[];
    duration_sec?: number[];
    caption_max?: number;
  };
};

export type CpPublishItem = {
  id: string;
  video_version_id: string;
  channel: string;
  profile_id?: string | null;
  scheduled_at?: string | null;
  tz?: string | null;
  copy?: string | null;
  hashtags?: string | null;
  thumbnail_asset_id?: string | null;
  cta?: string | null;
  utm_json?: unknown;
  audience?: string | null;
  compliance_label?: string | null;
  status: string;
  draft_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  agency_client_id?: string | null;
  approval_status?: string | null;
  qc_status?: string | null;
  kind?: 'video';
};

export type CpPublishInput = {
  video_version_id: string;
  channel: string;
  scheduled_at?: string | null;
  tz?: string;
  copy?: string | null;
  hashtags?: string | null;
  thumbnail_asset_id?: string | null;
  cta?: string | null;
  utm_json?: unknown;
  audience?: string | null;
  compliance_label?: string | null;
};

export type CpPublishVersion = {
  id: string;
  approval_status: string;
  qc_status?: string | null;
  version_n?: number | string;
  draft_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  eligible: boolean;
  schedulable?: boolean;
  rights_status?: 'ok' | 'warn' | 'block' | null;
  disclaimer_present?: boolean | null;
  lock_reason?: string | null;
};

export type CpPublishGateRow = {
  key: string;
  label: string;
  result: string | null;
  lock: string | null;
};

export type CpPublishGate = {
  version_id: string;
  schedulable: boolean;
  lock_reason: string | null;
  items: CpPublishGateRow[];
};

export function listCpPublishItems(
  token: string,
  query: CpOverviewQuery & {
    channel?: string;
    project?: string;
    approval?: string;
  } = {},
) {
  return cpFetch<{ items: CpPublishItem[] }>(
    token,
    cpQueryPath('/publish', query),
  );
}

export function listCpChannelProfiles(token: string) {
  return cpFetch<{ items: CpChannelProfile[] }>(token, '/publish/profiles');
}

export function listCpPublishVersions(token: string, scope: CpScope = 'me') {
  return cpFetch<{ items: CpPublishVersion[] }>(
    token,
    cpQueryPath('/publish/versions', { scope }),
  );
}

export function getCpPublishGate(
  token: string,
  versionId: string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpPublishGate>(
    token,
    cpQueryPath(`/publish/gate/${encodeURIComponent(versionId)}`, { scope }),
  );
}

export function createCpPublishItem(
  token: string,
  input: CpPublishInput,
  scope: CpScope = 'me',
) {
  return cpFetch<CpPublishItem>(
    token,
    cpQueryPath('/publish', { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export const CP_TEMPLATE_REQUIRED_VARS = [
  'project_name',
  'price_from',
  'location',
  'cta',
  'hotline',
] as const;

export type CpTemplate = {
  id: string;
  name: string;
  version: number | string;
  variables_json: string[];
  rules_json?: Record<string, unknown>;
  brand_kit_id?: string | null;
  status: string;
};

export type CpTemplateInput = {
  name: string;
  variables?: string[];
  rules_json?: Record<string, unknown>;
  brand_kit_id?: string | null;
};

export type CpBatchItem = {
  id?: string;
  batch_id?: string;
  row_no: number | string;
  row_json?: Record<string, unknown>;
  mapping_json?: Record<string, string>;
  status: string;
  error?: string | null;
  job_id?: string | null;
};

export type CpBatchJob = {
  id: string;
  template_id: string;
  project_id?: string | null;
  estimate_credits?: number | null;
  status: string;
  created_by?: number;
  items?: CpBatchItem[];
  valid_count?: number | null;
  invalid_count?: number | null;
  unit_credits?: number | null;
};

export type CpBatchInput = {
  template_id: string;
  project_id?: string | null;
  rows?: Record<string, unknown>[];
  mapping?: Record<string, string>;
  source?: {
    type?: string;
    client_id?: string;
    lifecycle_id?: number | string;
    columns?: string[];
  };
};

export function listCpTemplates(token: string) {
  return cpFetch<{ items: CpTemplate[] }>(token, '/templates');
}

export function createCpTemplate(token: string, input: CpTemplateInput) {
  return cpFetch<CpTemplate>(token, '/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function publishCpTemplate(token: string, templateId: string) {
  return cpFetch<CpTemplate>(token, `/templates/${encodeURIComponent(templateId)}/publish`, {
    method: 'POST',
  });
}

export function useCpTemplate(
  token: string,
  templateId: string,
  input: { project_id: string; name?: string },
  scope: CpScope = 'me',
) {
  return cpFetch<CpVideoDraft>(
    token,
    cpQueryPath(`/templates/${encodeURIComponent(templateId)}/use`, { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function createCpBatch(token: string, input: CpBatchInput, scope: CpScope = 'me') {
  return cpFetch<CpBatchJob>(
    token,
    cpQueryPath('/batches', { scope }),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function getCpBatch(token: string, batchId: string, scope: CpScope = 'me') {
  return cpFetch<CpBatchJob>(
    token,
    cpQueryPath(`/batches/${encodeURIComponent(batchId)}`, { scope }),
  );
}

export function validateCpBatch(token: string, batchId: string, scope: CpScope = 'me') {
  return cpFetch<CpBatchJob>(
    token,
    cpQueryPath(`/batches/${encodeURIComponent(batchId)}/validate`, { scope }),
    { method: 'POST' },
  );
}

export function runCpBatch(token: string, batchId: string, scope: CpScope = 'me') {
  return cpFetch<CpBatchJob>(
    token,
    cpQueryPath(`/batches/${encodeURIComponent(batchId)}/run`, { scope }),
    { method: 'POST' },
  );
}

export function retryCpBatchItem(
  token: string,
  batchId: string,
  rowNo: number | string,
  scope: CpScope = 'me',
) {
  return cpFetch<CpBatchItem>(
    token,
    cpQueryPath(
      `/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(String(rowNo))}/retry`,
      { scope },
    ),
    { method: 'POST' },
  );
}

export async function getCpBatchErrorsCsv(
  token: string,
  batchId: string,
  scope: CpScope = 'me',
): Promise<string> {
  const path = cpQueryPath(`/batches/${encodeURIComponent(batchId)}/errors.csv`, { scope });
  const res = await fetch(`${API_BASE}/api/crm/cp${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new CpApiError(text || 'CP request failed', res.status);
  }
  return text;
}
