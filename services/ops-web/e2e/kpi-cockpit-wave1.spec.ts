import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('KPI cockpit Wave 1', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi shows cockpit tiles, tabs, and donut', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.getByRole('heading', { name: /quản lý kpi/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-tile-grid').getByText(/đúng tiến độ/i)).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Cần theo dõi/i)).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Không đạt/i)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tất cả' })).toBeVisible();
    await expect(page.getByTestId('kpi-rag-donut')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nhập actual KPI/i })).toBeVisible();
  });
});
