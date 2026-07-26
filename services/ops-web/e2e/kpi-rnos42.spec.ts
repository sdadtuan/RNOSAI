import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-42 — KPI dashboard UX smoke (tiles, no JSON dump UI).
 */
test.describe('RNOS-42 KPI UX', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi shows KPI tiles and chart section', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.kpi-tile-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /chỉ tiêu kpi/i })).toBeVisible();
    await expect(page.locator('.kpi-bar-chart')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('/crm/business-dashboard shows 2x2 executive tiles', async ({ page }) => {
    await page.goto('/crm/business-dashboard');
    const tiles = page.locator('.kpi-tile-grid .kpi-tile');
    await expect(tiles).toHaveCount(4, { timeout: 20_000 });
    await expect(page.locator('.kpi-tile-grid').getByText(/MRR bookings/i)).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Retention MoM/i)).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('/crm/staff-kpi shows progress list', async ({ page }) => {
    await page.goto('/crm/staff-kpi');
    await expect(page.locator('.kpi-progress-list, .kpi-bar-chart')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /kpi am \/ sp/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});
