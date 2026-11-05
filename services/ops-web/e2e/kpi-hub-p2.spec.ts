import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('KPI Hub P2 integration', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('dashboard loads from API with drill-down', async ({ page }) => {
    await page.goto('/crm/kpi-hub');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-hub-dash-cards')).toBeVisible();
    const card = page.locator('.kpi-hub-dash-card--clickable').first();
    await card.click();
    await expect(page.locator('.kpi-hub-drilldown')).toBeVisible({ timeout: 10_000 });
  });

  test('dictionary formula tab has filter builder', async ({ page }) => {
    await page.goto('/crm/kpi-hub/dictionary');
    await expect(page.getByText('MKT_006')).toBeVisible({ timeout: 20_000 });
    const row = page.locator('tr', { hasText: 'MKT_006' }).first();
    await row.getByRole('link').first().click();
    await page.getByRole('tab', { name: /Công thức/i }).click();
    await expect(page.locator('.kpi-hub-formula-filter-builder')).toBeVisible({ timeout: 10_000 });
  });
});
