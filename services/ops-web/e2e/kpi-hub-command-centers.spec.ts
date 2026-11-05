import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('KPI Hub Command Centers', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('executive chrome', async ({ page }) => {
    await page.goto('/crm/kpi-hub/executive');
    if (page.url().includes('/login')) test.skip();
    await expect(page.getByRole('heading', { name: 'Executive Command Center' })).toBeVisible({
      timeout: 20_000,
    });
    for (const id of [
      'exec-kpi-tiles',
      'exec-forecast',
      'exec-at-risk',
      'exec-funnel',
      'exec-trust',
      'exec-approvals',
      'exec-exceptions',
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
    await expect(page.getByText('TỔNG QUAN')).toBeVisible();
    await expect(page.getByText('GOVERNANCE')).toBeVisible();
  });

  test('marketing chrome', async ({ page }) => {
    await page.goto('/crm/kpi-hub/marketing');
    if (page.url().includes('/login')) test.skip();
    await expect(page.getByRole('heading', { name: 'Marketing Performance' })).toBeVisible({
      timeout: 20_000,
    });
    for (const id of [
      'mkt-kpi-tiles',
      'mkt-media-chart',
      'mkt-channel-donut',
      'mkt-funnel',
      'mkt-alerts',
      'mkt-campaigns',
      'mkt-creatives',
      'mkt-trust',
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
  });

  test('sales chrome', async ({ page }) => {
    await page.goto('/crm/kpi-hub/sales');
    if (page.url().includes('/login')) test.skip();
    await expect(page.getByRole('heading', { name: 'Sales Command Center' })).toBeVisible({
      timeout: 20_000,
    });
    for (const id of [
      'sales-kpi-tiles',
      'sales-pipeline',
      'sales-sla-gauge',
      'sales-funnel',
      'sales-alerts',
      'sales-team-table',
      'sales-deals-risk',
      'sales-trust',
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
  });

  test('kpi-hub index redirects to executive', async ({ page }) => {
    await page.goto('/crm/kpi-hub');
    if (page.url().includes('/login')) test.skip();
    await expect(page).toHaveURL(/\/crm\/kpi-hub\/executive/, { timeout: 20_000 });
  });

  test('cockpit unchanged', async ({ page }) => {
    await page.goto('/crm/kpi');
    if (page.url().includes('/login')) test.skip();
    await expect(page).not.toHaveURL(/kpi-hub/);
  });
});
