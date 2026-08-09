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

export type OpsHubPayload = {
  lifecycle: {
    id: number;
    slug: string;
    client_name: string;
    status: string;
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
  };
  kpi: {
    period_key: string;
    metrics: unknown[];
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

async function opsFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
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

export function parseOpsHubError(err: unknown): string {
  if (err instanceof OpsApiError) {
    switch (err.code) {
      case 'ops_dv_disabled':
        return 'Ops Hub chưa bật trên server (PTT_OPS_DV_ENABLED).';
      case 'unknown_service_slug':
        return 'Slug dịch vụ chưa map DV — liên hệ admin.';
      case 'dv_not_found':
        return 'Không tìm thấy profile DV.';
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Tải Ops Hub thất bại';
}
