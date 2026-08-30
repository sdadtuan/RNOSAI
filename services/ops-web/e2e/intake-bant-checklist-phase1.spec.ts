import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  createPhoneSession,
  nestApiReachable,
  openIntakeForLead,
  resolveIntakeLeadId,
} from './helpers/intake-bant-helpers';
import { setupPresalesLeadStage } from './helpers/funnel-stepper-helpers';

/**
 * INT-BANT-CL-P1 Task 7 — U1–U4: Qualify radios gone; drawer ticks score; warn + next-step.
 *
 * Run: cd services/ops-web && npx playwright test e2e/intake-bant-checklist-phase1.spec.ts
 * Skip if Nest API is down or presales setup fails.
 */

async function openDraftIntake(page: Page, request: APIRequestContext): Promise<void> {
  const leadId = await resolveIntakeLeadId(request);
  const setup = await setupPresalesLeadStage(request, leadId);
  if (!setup.ok) test.skip(true, setup.reason);

  await openIntakeForLead(page, leadId);
  await createPhoneSession(page);
}

async function openBantDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'BANT' }).click();
  await expect(page.getByTestId('intake-bant-drawer')).toBeVisible();
}

test.describe('Intake BANT checklist Phase 1 (U1–U4)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('U1 Qualify has no BANT radios and Deal Bar has BANT', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await expect(page.getByRole('button', { name: 'BANT' })).toBeVisible();
    await page.getByRole('tab', { name: /Qualify/i }).click();
    await expect(page.locator('[name="intake-bant-budget"]')).toHaveCount(0);
  });

  test('U2 ticking Budget 4 updates score without radios', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await openBantDrawer(page);
    await page.getByLabel(/Có khung rõ/i).check();
    await expect(page.locator('.intake-deal-bar__score')).toContainText(/BANT [4-9]/);
    await expect(page.getByText(/Đủ Tư vấn|để Tư vấn/).first()).toBeVisible();
    await expect(page.locator('[name="intake-bant-budget"]')).toHaveCount(0);
  });

  test('U3 ticking Budget without Discovery shows evidence warn', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await openBantDrawer(page);
    await page.getByLabel(/Có khung rõ/i).check();
    await expect(page.getByText(/Chưa có ghi chú Discovery/)).toBeVisible();
  });

  test('U4 next-step heading visible after a few ticks', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await openBantDrawer(page);
    await page.getByLabel(/Có khung rõ/i).check();
    await page.getByLabel(/Đã nói với DM/i).check();
    await expect(
      page.getByRole('heading', { name: /Còn mục chưa chấm|Gợi ý:/ }),
    ).toBeVisible();
  });
});
