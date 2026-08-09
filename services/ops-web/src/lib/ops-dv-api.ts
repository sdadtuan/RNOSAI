import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export class OpsApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
  ) {
    super(message, status);
    this.name = 'OpsApiError';
  }
}

export type OpsHubEngine = {
  id: string;
  label: string;
  href: string;
  status: string;
  badge: string | null;
};

export type OpsKpiMetric = {
  key: string;
  label: string;
  unit?: string;
  actual: number | null;
  target: number | null;
  status_label?: 'Dat' | 'CanChuY' | 'KhongDat';
};

export type OpsWeeklyChecklistItem = {
  id: number;
  template_task_id: string;
  title: string;
  owner_role: string;
  day_of_week: number | null;
  status: 'pending' | 'done' | 'skipped';
  kpi_key: string | null;
  completed_at: string | null;
};

export type OpsHubPayload = {
  lifecycle: {
    id: number;
    slug: string;
    client_name: string;
    status: string;
    stage?: string;
    package_tier: string;
  };
  dv: {
    dv_code: string;
    name: string;
    readiness: string;
  };
  engines: OpsHubEngine[];
  weekly: {
    iso_week: string;
    spawned: boolean;
    tasks_pending: number;
    tasks_done: number;
    items?: OpsWeeklyChecklistItem[];
  };
  kpi: {
    period_type: 'week' | 'month';
    period_key: string;
    metrics: OpsKpiMetric[];
  };
  flags: {
    ops_dv_enabled: boolean;
    weekly_spawn_enabled: boolean;
    pilot_dv: boolean;
  };
};

export type OpsCatalogResponse = {
  schema_version: string;
  services: Array<{
    dv_code: string;
    name: string;
    service_slug: string;
    readiness: string;
  }>;
};

export type OpsSpawnWeekResult = {
  iso_week: string;
  dv_code: string;
  created: number;
  already_spawned: boolean;
  items: OpsWeeklyChecklistItem[];
};

async function opsFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeaders(token) as Record<string, string>),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new OpsApiError(
      body.message ?? body.error ?? 'Ops request failed',
      res.status,
      body.error,
    );
  }
  return body;
}

export async function fetchOpsHub(token: string, lifecycleId: number): Promise<OpsHubPayload> {
  return opsFetch<OpsHubPayload>(token, `/api/ops/lifecycle/${lifecycleId}/hub`);
}

export async function fetchOpsCatalog(token: string): Promise<OpsCatalogResponse> {
  return opsFetch<OpsCatalogResponse>(token, '/api/ops/catalog');
}

export async function spawnOpsWeek(token: string, lifecycleId: number): Promise<OpsSpawnWeekResult> {
  return opsFetch<OpsSpawnWeekResult>(token, `/api/ops/lifecycle/${lifecycleId}/spawn-week`, {
    method: 'POST',
  });
}

export async function patchOpsWeeklyItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  status: 'pending' | 'done' | 'skipped',
): Promise<OpsWeeklyChecklistItem> {
  return opsFetch<OpsWeeklyChecklistItem>(
    token,
    `/api/ops/lifecycle/${lifecycleId}/weekly/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function putOpsKpi(
  token: string,
  lifecycleId: number,
  body: {
    period_type?: 'week' | 'month';
    period_key?: string;
    metrics: Record<string, { actual?: number | null; target?: number | null }>;
  },
): Promise<{ metrics: OpsKpiMetric[] }> {
  return opsFetch(token, `/api/ops/lifecycle/${lifecycleId}/kpi`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function parseOpsHubError(err: unknown): string {
  if (err instanceof OpsApiError) {
    switch (err.code) {
      case 'ops_dv_disabled':
        return 'Ops Hub chưa bật trên server (PTT_OPS_DV_ENABLED).';
      case 'unknown_service_slug':
        return 'Slug dịch vụ chưa map DV — liên hệ admin.';
      case 'dv_not_found':
        return 'Không tìm thấy profile DV.';
      case 'weekly_spawn_disabled':
        return 'Spawn tuần chưa bật (PTT_OPS_WEEKLY_SPAWN).';
      case 'lifecycle_not_active':
        return 'Lifecycle chưa active — không thể sinh checklist.';
      case 'lifecycle_stage_not_delivering':
        return 'Lifecycle chưa vào giai đoạn triển khai (onboard/deliver).';
      case 'empty_weekly_template':
        return 'DV chưa có weekly template — chạy seed pilot.';
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Tải Ops Hub thất bại';
}
