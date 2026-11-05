import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';
import { hasCap, staffCaps } from './kpi-groups-helpers';

export async function staffHasKpiTypesView(request: APIRequestContext): Promise<boolean> {
  const caps = await staffCaps(request);
  return hasCap(caps, 'crm_kpi_types', 'view');
}

export async function staffHasKpiTypesManage(request: APIRequestContext): Promise<boolean> {
  const caps = await staffCaps(request);
  return hasCap(caps, 'crm_kpi_types', 'manage');
}

export async function deleteKpiTypeByCode(request: APIRequestContext, code: string): Promise<void> {
  const token = await staffToken(request);
  const list = await request.get(
    `${API_URL}/api/v1/kpi-types?q=${encodeURIComponent(code)}&page_size=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!list.ok()) return;
  const body = (await list.json()) as { data?: Array<{ id: string; code: string; usage_count?: number }> };
  const row = (body.data ?? []).find((r) => r.code === code);
  if (!row || (row.usage_count ?? 0) > 0) return;
  await request.delete(`${API_URL}/api/v1/kpi-types/${encodeURIComponent(row.id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function e2eKpiTypeCode(): string {
  const suffix = Date.now().toString().slice(-6);
  return `E2E_TYPE_${suffix}`;
}
