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

export async function selectIntakeService(
  page: Page,
  slug = 'dich-vu-seo-tong-the',
): Promise<void> {
  const select = page.locator('.intake-deal-bar__service select.intake-deal-bar__select');
  await expect(select).toBeVisible({ timeout: 15_000 });
  await select.selectOption(slug);
}

export async function createPhoneSession(page: Page): Promise<void> {
  await selectIntakeService(page);
  const dialogWait = page.waitForEvent('dialog', { timeout: 5_000 }).catch(() => null);
  const createBtn = page.getByRole('button', { name: '+ Gọi điện' });
  await createBtn.scrollIntoViewIfNeeded();
  await createBtn.click();
  const dialog = await dialogWait;
  if (dialog) await dialog.accept();

  const sessionTitle = page.locator('.intake-form__title').filter({ hasText: /Phiên #\d+/ });
  await expect(sessionTitle).toContainText(/Phiên #\d+ · .* · Nháp/i, {
    timeout: 20_000,
  });
}

export async function fillDiscoveryBasics(page: Page, contactName: string, needText: string): Promise<void> {
  const discoveryTab = page.getByRole('tab', { name: /^Discovery$/i });
  if (await discoveryTab.count()) {
    await discoveryTab.click();
  }
  const contactInput = page.locator('.intake-discovery-section').locator('input.kpi-input').first();
  await contactInput.fill(contactName);

  const needEditor = page.locator('.intake-discovery-section .rich-text-field__editor').first();
  await needEditor.click();
  await needEditor.fill(needText);
}

export async function tickDiscoveryChecklist(page: Page, count: number): Promise<void> {
  const discoveryTab = page.getByRole('tab', { name: /^Discovery$/i });
  if (await discoveryTab.count()) {
    await discoveryTab.click();
  }
  const boxes = page.locator('.intake-discovery-checklist__item input[type=checkbox]');
  await expect(boxes.first()).toBeVisible({ timeout: 15_000 });
  const total = await boxes.count();
  const toTick = Math.min(count, total);
  for (let i = 0; i < toTick; i += 1) {
    const item = page.locator('.intake-discovery-checklist__item').nth(i);
    await boxes.nth(i).check();
    const answer = item.locator('textarea, .intake-discovery-checklist__answer-input, input.kpi-input').first();
    if (await answer.count()) {
      await answer.fill(`E2E answer ${i + 1}`);
    }
  }
}

export async function fillDecisionMaker(page: Page, name = 'E2E Decision Maker'): Promise<void> {
  const handoffTab = page.getByRole('tab', { name: /Handoff/i });
  if (await handoffTab.count()) {
    await handoffTab.click();
  }
  const summary = page.locator('.intake-stakeholder-section summary');
  if (await summary.count()) {
    const details = page.locator('.intake-stakeholder-section');
    const open = await details.getAttribute('open');
    if (open === null) await summary.click();
  }
  const nameInput = page.locator('.intake-stakeholder-table__row input.kpi-input').first();
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await nameInput.fill(name);
}

export async function scoreBant(page: Page, score: number): Promise<void> {
  const drawer = page.getByTestId('intake-bant-drawer');
  const checklist = page.locator('#intake-bant-checklist');
  const alreadyOpen = (await drawer.isVisible()) || (await checklist.isVisible());

  if (!alreadyOpen) {
    await page.getByRole('button', { name: 'BANT', exact: true }).click();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
  }

  const expectedTotal = score * BANT_KEYS.length;

  await expect
    .poll(async () => {
      await page.evaluate(
        ({ keys, scoreValue }) => {
          for (const key of keys) {
            const input = document.getElementById(
              `bant-check-${key}-${scoreValue}`,
            ) as HTMLInputElement | null;
            if (!input || input.checked) continue;
            input.click();
          }
        },
        { keys: [...BANT_KEYS], scoreValue: score },
      );
      const dealBar = page.locator('.intake-deal-bar__score');
      const drawerTotal = page.locator('#intake-bant-checklist .intake-kit__footer');
      const dealText = (await dealBar.count()) > 0 ? await dealBar.innerText() : '';
      const drawerText = (await drawerTotal.count()) > 0 ? await drawerTotal.innerText() : '';
      const text = `${dealText}\n${drawerText}`;
      const match = text.match(/(\d+)\s*\/\s*30/);
      return match ? Number(match[1]) : 0;
    }, { timeout: 20_000 })
    .toBe(expectedTotal);

  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: 'Đóng' }).click();
    await expect(drawer).toBeHidden({ timeout: 10_000 });
  }
}

export async function selectDecision(page: Page, value: 'go' | 'nurture' | 'no_go'): Promise<void> {
  await page.locator('.intake-bant-decision-pane select.kpi-select').selectOption(value);
}

export async function completeIntakeSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Hoàn thành phiên' }).click();
  await expect(page.getByRole('dialog', { name: /Hoàn thành phiên/i })).toBeVisible();
  const confirmBtn = page.getByRole('button', { name: /^(Vẫn hoàn thành|Hoàn thành)$/ });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await expect(page.getByText(/Đã hoàn thành phiên/i)).toBeVisible({ timeout: 20_000 });
  const sessionTitle = page.locator('.intake-form__title').filter({ hasText: /Phiên #\d+/ });
  await expect(sessionTitle).toContainText(/Hoàn thành "Completed"/i);
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
