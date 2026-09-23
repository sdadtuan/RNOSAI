import { API_BASE } from '@/lib/api';

export type StrategyPackRow = {
  key: string;
  name_vi: string;
  journey_focus: string | null;
  marketing_priorities: string | null;
  defaults_json: Record<string, unknown>;
  is_active: boolean;
  version: number;
};

export type GrowthSectionsResponse = {
  ok: boolean;
  plan_id: number;
  growth_sections: Record<string, unknown>;
  fill_pct: Record<string, number>;
  warnings: string[];
};

async function crm<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchStrategyPacks(token: string) {
  return crm<{ industry_packs: StrategyPackRow[]; service_packs: StrategyPackRow[] }>(
    token,
    '/api/crm/strategy-packs',
  );
}

export function patchStrategyPack(
  token: string,
  kind: 'industry' | 'service',
  key: string,
  body: { defaults_json?: Record<string, unknown>; is_active?: boolean; name_vi?: string },
) {
  return crm<StrategyPackRow>(token, `/api/crm/strategy-packs/${kind}/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchGrowthSections(token: string, planId: number) {
  return crm<GrowthSectionsResponse>(token, `/api/crm/marketing-plans/${planId}/growth-sections`);
}

export function saveGrowthSections(token: string, planId: number, patch: Record<string, unknown>) {
  return crm<GrowthSectionsResponse>(token, `/api/crm/marketing-plans/${planId}/growth-sections`, {
    method: 'PUT',
    body: JSON.stringify({ patch, dry_run: false }),
  });
}

export function savePlanPackKeys(
  token: string,
  planId: number,
  keys: { industry_pack_key?: string | null; service_pack_key?: string | null },
) {
  return crm(token, `/api/crm/marketing-plans/${planId}/pack-keys`, {
    method: 'PATCH',
    body: JSON.stringify(keys),
  });
}

export type GenerateDraftResponse = {
  ok: boolean;
  phase: string;
  plan_id: number;
  dry_run: boolean;
  industry_pack_key: string;
  service_pack_key: string;
  coverage: { known: string[]; assumed: string[]; tbd: string[] };
  blocks_touched: string[];
  warnings: string[];
  links: Array<{ rel: string; href: string }>;
  growth_sections: Record<string, unknown>;
};

export function generateStrategyDraft(
  token: string,
  planId: number,
  body: {
    industry_pack_key?: string | null;
    service_pack_key?: string | null;
    overwrite_mode: 'fill_empty_only' | 'refresh_assumed' | 'replace_all_ai';
    dry_run: boolean;
    persist: boolean;
  },
) {
  return crm<GenerateDraftResponse>(token, `/api/crm/marketing-plans/${planId}/generate-draft`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
