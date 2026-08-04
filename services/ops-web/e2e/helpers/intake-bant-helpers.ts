import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, resolveLeadId, staffToken } from './ai-copilot-helpers';

export const BANT_KEYS = ['budget', 'authority', 'need', 'timeline', 'fit', 'history'] as const;

export async function nestApiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const health = await request.get(`${API_URL}/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

export async function resolveIntakeLeadId(request: APIRequestContext): Promise<number> {
  return resolveLeadId(request);
}

export async function openIntakeForLead(page: Page, leadId: number): Promise<void> {
  await page.goto(`/crm/intake?lead_id=${leadId}`);
  await expect(page.getByRole('heading', { level: 2, name: /Khảo sát BANT/i })).toBeVisible({
    timeout: 20_000,
  });
}

export async function createPhoneSession(page: Page): Promise<void> {
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: '+ Gọi điện' }).click();
  await expect(page.locator('.intake-form__title')).toContainText(/Phiên #\d+ · .* · Nháp/i, {
    timeout: 20_000,
  });
}

export async function fillDiscoveryBasics(page: Page, contactName: string, needText: string): Promise<void> {
  const contactInput = page.locator('.intake-discovery-section').locator('input.kpi-input').first();
  await contactInput.fill(contactName);

  const needEditor = page.locator('.intake-discovery-section .rich-text-field__editor').first();
  await needEditor.click();
  await needEditor.fill(needText);
}

export async function tickDiscoveryChecklist(page: Page, count: number): Promise<void> {
  const boxes = page.locator('.intake-discovery-checklist__item input[type=checkbox]');
  await expect(boxes.first()).toBeVisible({ timeout: 15_000 });
  const total = await boxes.count();
  const toTick = Math.min(count, total);
  for (let i = 0; i < toTick; i += 1) {
    await boxes.nth(i).check();
  }
}

export async function scoreBant(page: Page, score: number): Promise<void> {
  for (const key of BANT_KEYS) {
    await page.locator(`#intake-bant-${key}-${score}`).check();
  }
  await expect(page.locator('.intake-bant-total-bar')).toContainText(`${score * BANT_KEYS.length}/30`);
}

export async function selectDecision(page: Page, value: 'go' | 'nurture' | 'no_go'): Promise<void> {
  await page.locator('.intake-bant-decision-pane select.kpi-select').selectOption(value);
}

export async function completeIntakeSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Hoàn thành phiên' }).click();
  await expect(page.getByRole('dialog', { name: /Hoàn thành phiên/i })).toBeVisible();
  await page.getByRole('button', { name: 'Vẫn hoàn thành' }).click();
  await expect(page.getByText(/Đã hoàn thành phiên khảo sát/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.intake-form__title')).toContainText(/Hoàn thành "Completed"/i);
}

export async function fetchLatestIntakeSession(
  request: APIRequestContext,
  leadId: number,
): Promise<{ id: number; status: string } | null> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/crm/intake/sessions?lead_id=${leadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { sessions?: Array<{ id: number; status: string }> };
  const sessions = body.sessions ?? [];
  return sessions.sort((a, b) => b.id - a.id)[0] ?? null;
}
