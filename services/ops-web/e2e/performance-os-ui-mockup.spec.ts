import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Performance OS UI mockup alignment', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('PM-01 dashboard six tiles and Performance side-note', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance');
    await expect(page.getByRole('heading', { level: 1, name: 'Operating Dashboard' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('PM-01 · Nhịp tuần agency')).toBeVisible();
    await expect(page.locator('.kpi-hub-pm-kpis--6')).toHaveCount(1);
    await expect(page.locator('.kpi-hub-pm-kpis--6 article')).toHaveCount(6);
    await expect(page.getByText('DATA BLOCKED')).toBeVisible();
    await expect(page.locator('.kpi-hub-sidebar__side-note').getByText('Performance OS · moat')).toBeVisible();
  });

  test('PM-02 registry filter chips', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/assignments');
    await expect(page.getByRole('heading', { level: 1, name: 'Assignment Registry' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-hub-pm-filter').first()).toBeVisible();
    await expect(page.getByText('Tháng 09/2026')).toBeVisible();
  });

  test('PM-07 marketing five tiles', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/marketing');
    await expect(page.getByRole('heading', { level: 1, name: 'Marketing OS' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-hub-pm-kpis--5 article')).toHaveCount(5);
  });

  test('sidebar performance nav badges', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance');
    await expect(page.locator('.kpi-hub-sidebar').getByText('Assignment Registry')).toBeVisible({
      timeout: 20_000,
    });
    const registryLink = page.locator('.kpi-hub-sidebar__link').filter({ hasText: 'Assignment Registry' });
    await expect(registryLink.locator('.kpi-hub-sidebar__count')).toBeVisible();
  });
});
