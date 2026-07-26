import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-24 — CRM tickets lite CRUD smoke.
 */
test.describe('RNOS-24 CRM tickets', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/tickets shows table and create form', async ({ page }) => {
    await page.goto('/crm/tickets');
    await expect(page.getByRole('heading', { level: 2, name: /ticket cs lite/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.crm-tickets-table')).toBeVisible();
    await expect(page.getByRole('button', { name: /tạo ticket/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});
