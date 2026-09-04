import { test, expect } from '@playwright/test';

test('budget step chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects/new?step=4');
  if (page.url().includes('/login')) test.skip();
  await expect(page.locator('[data-testid="budget-header-tiles"]')).toBeVisible();
  await expect(page.getByText(/không tính revenue/i)).toBeVisible();
});
