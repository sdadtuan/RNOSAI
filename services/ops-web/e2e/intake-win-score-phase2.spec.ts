import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  createPhoneSession,
  nestApiReachable,
  openIntakeForLead,
  resolveIntakeLeadId,
} from './helpers/intake-bant-helpers';
import {
  completeIntakeGoSession,
  funnelStepper,
  setupPresalesLeadStage,
} from './helpers/funnel-stepper-helpers';

/**
 * INT-WIN-P2 Task 8 — U1–U3: Deal Bar WIN + BANT Tư vấn copy; tick incumbent 4; live Consult-gate.
 *
 * Run: cd services/ops-web && npx playwright test e2e/intake-win-score-phase2.spec.ts
 * Skip if Nest API is down or presales setup fails.
 * U3 skips unless PTT_INTAKE_WIN_GATE=1 (health/env). Do not enable that flag on prod.
 */

async function openDraftIntake(page: Page, request: APIRequestContext): Promise<void> {
  const leadId = await resolveIntakeLeadId(request);
  const setup = await setupPresalesLeadStage(request, leadId);
  if (!setup.ok) test.skip(true, setup.reason);

  await openIntakeForLead(page, leadId);
  await createPhoneSession(page);
}

async function intakeWinGateEnabled(request: APIRequestContext): Promise<boolean> {
  if (process.env.PTT_INTAKE_WIN_GATE === '1') return true;
  try {
    const health = await request.get(`${API_URL}/health`, { timeout: 8_000 });
    if (!health.ok()) return false;
    const body = (await health.json()) as Record<string, unknown>;
    const flag = body.PTT_INTAKE_WIN_GATE ?? body.intake_win_gate ?? body.ptt_intake_win_gate;
    return flag === '1' || flag === 1 || flag === true;
  } catch {
    return false;
  }
}

async function openFunnelIfNeeded(page: Page): Promise<void> {
  const stepper = funnelStepper(page);
  if (await stepper.isVisible()) return;
  const toggle = page.getByRole('button', { name: /Funnel/i });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  await expect(stepper).toBeVisible({ timeout: 15_000 });
}

test.describe('Intake Win-score Phase 2 (U1–U3)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('U1 Deal Bar has WIN and BANT Tư vấn copy', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await expect(page.getByRole('button', { name: 'WIN', exact: true })).toBeVisible();
    await expect(page.getByText(/Đủ Tư vấn|để Tư vấn/).first()).toBeVisible();
  });

  test('U2 ticking incumbent 4 updates Win score', async ({ page, request }) => {
    await openDraftIntake(page, request);
    await page.getByRole('button', { name: 'WIN', exact: true }).click();
    await expect(page.getByTestId('intake-win-drawer')).toBeVisible();
    await page.getByLabel(/Tên \+ lỗ hổng cụ thể/i).check();
    await expect(page.getByText(/Win [4-9]/).first()).toBeVisible();
  });

  test('U3 live Consult-gate blocks Go when Win thin', async ({ page, request }) => {
    test.skip(!(await intakeWinGateEnabled(request)), 'PTT_INTAKE_WIN_GATE is not 1');

    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await openIntakeForLead(page, leadId);
    await completeIntakeGoSession(page, Date.now());
    await openFunnelIfNeeded(page);

    const stepper = funnelStepper(page);
    await expect(stepper.locator('.intake-gate-banner--block')).toBeVisible({ timeout: 20_000 });
    await expect(stepper).toContainText(/Thiếu Win intel|Win \d+\/30 dưới ngưỡng/i);
  });
});
