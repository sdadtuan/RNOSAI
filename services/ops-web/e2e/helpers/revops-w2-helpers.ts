import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';

export type RevopsApprovalItemDto = {
  id: string;
  sourceKind: string;
  title: string;
  canAct: boolean;
};

export type RevopsApprovalsDto = {
  queue: RevopsApprovalItemDto[];
};

export type AmAccountDto = {
  agency_client_id: string;
  name: string;
  code: string;
};

export type StaffRosterRowDto = {
  id: number;
  display_name: string;
};

export async function fetchRevopsApprovalsApi(
  request: APIRequestContext,
  token: string,
): Promise<RevopsApprovalsDto> {
  const res = await request.get(`${API_URL}/api/crm/revops/approvals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `revops approvals: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as RevopsApprovalsDto;
}

export async function fetchRevopsPipelineApi(
  request: APIRequestContext,
  token: string,
): Promise<{ columns: Array<{ cards: Array<{ leadId: number; href: string }> }> }> {
  const res = await request.get(`${API_URL}/api/crm/revops/pipeline?view=kanban`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `revops pipeline: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as { columns: Array<{ cards: Array<{ leadId: number; href: string }> }> };
}

export async function fetchAmAccountsApi(
  request: APIRequestContext,
  token: string,
): Promise<AmAccountDto[]> {
  const res = await request.get(`${API_URL}/api/crm/am/accounts?page_size=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `am accounts: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { items?: AmAccountDto[] };
  return body.items ?? [];
}

export async function fetchStaffRosterApi(
  request: APIRequestContext,
  token: string,
): Promise<StaffRosterRowDto[]> {
  const res = await request.get(`${API_URL}/api/v1/staff/auth/roster`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `staff roster: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { staff?: StaffRosterRowDto[] };
  return body.staff ?? [];
}

export async function openRevopsQuickCreateTile(page: Page, tile: RegExp): Promise<void> {
  await page.getByRole('button', { name: /Tạo nhanh/ }).click();
  await page.getByRole('button', { name: tile }).click();
}

export async function expectRequiredFieldMarkers(page: Page, minCount: number): Promise<void> {
  await expect(page.locator('.revops-req')).toHaveCount(minCount, { timeout: 5_000 });
}

export { staffToken };
