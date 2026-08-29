import { test, expect, type Page } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  createPhoneSession,
  nestApiReachable,
  openIntakeForLead,
  resolveIntakeLeadId,
} from './helpers/intake-bant-helpers';
import { fetchLeadFunnelApi, setupPresalesLeadStage } from './helpers/funnel-stepper-helpers';

/**
 * INT-SK Task 9 — Intake Deal Bar + workspace tabs + Sales Kit chips (S0–S2).
 * Rules-only; do not require LLM.
 *
 * Run: cd services/ops-web && npx playwright test e2e/intake-deal-bar-sales-kit.spec.ts
 */

async function openSalesKitIfNeeded(page: Page): Promise<void> {
  const chip = page.getByRole('button', { name: 'Còn thiếu để Go' });
  if (await chip.isVisible()) return;
  const toggle = page.getByRole('button', { name: 'Sales Kit' });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  await expect(chip).toBeVisible({ timeout: 15_000 });
}

test.describe('Intake Deal Bar + Sales Kit (S0–S2)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('deal bar and discovery tab replace stacked context cards', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await openIntakeForLead(page, leadId);
    await expect(page.locator('.intake-deal-bar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A. Ngữ cảnh lead' })).toHaveCount(0);

    await createPhoneSession(page);
    await expect(page.getByRole('tab', { name: /Discovery/i })).toBeVisible();

    const funnel = await fetchLeadFunnelApi(request, leadId);
    const slug = funnel.presales?.presales?.service_slug ?? '';
    if (slug === 'dich-vu-seo-tong-the') {
      await page.getByRole('tab', { name: /Discovery/i }).click();
      await expect(page.getByText(/Website\/domain cần SEO|seo_domain/i)).toBeVisible();
    }
  });

  test('kit chip Còn thiếu để Go shows 24 when BANT is 0', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);
    await expect(page.locator('.intake-deal-bar')).toContainText(/BANT 0\/30/);

    await openSalesKitIfNeeded(page);
    const chip = page.getByRole('button', { name: 'Còn thiếu để Go' });
    await expect(chip).toBeEnabled();
    await chip.click();

    const kit = page.locator('.intake-kit');
    await expect(kit.locator('.intake-kit__reply-text')).toContainText(/Còn 24/, {
      timeout: 20_000,
    });
  });
});
