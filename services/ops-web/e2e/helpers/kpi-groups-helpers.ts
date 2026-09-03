import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';

export type StaffCap = { section: string; action: string };

export async function staffCaps(request: APIRequestContext): Promise<StaffCap[]> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/v1/staff/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `staff me: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { caps?: StaffCap[] };
  return body.caps ?? [];
}

export function hasCap(caps: StaffCap[], section: string, action: string): boolean {
  return caps.some((c) => c.section === section && c.action === action);
}

export async function staffHasKpiGroupsView(request: APIRequestContext): Promise<boolean> {
  const caps = await staffCaps(request);
  return hasCap(caps, 'crm_kpi_groups', 'view');
}

export async function staffHasKpiGroupsManage(request: APIRequestContext): Promise<boolean> {
  const caps = await staffCaps(request);
  return hasCap(caps, 'crm_kpi_groups', 'manage');
}

export async function deleteKpiGroupByCode(request: APIRequestContext, code: string): Promise<void> {
  const token = await staffToken(request);
  const list = await request.get(
    `${API_URL}/api/v1/kpi-groups?q=${encodeURIComponent(code)}&page_size=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!list.ok()) return;
  const body = (await list.json()) as { data?: Array<{ id: string; code: string; usage_count?: number }> };
  const row = (body.data ?? []).find((r) => r.code === code);
  if (!row || (row.usage_count ?? 0) > 0) return;
  await request.delete(`${API_URL}/api/v1/kpi-groups/${encodeURIComponent(row.id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function e2eKpiGroupCode(): string {
  const suffix = Date.now().toString().slice(-6);
  return `E2E_KPI_${suffix}`;
}
