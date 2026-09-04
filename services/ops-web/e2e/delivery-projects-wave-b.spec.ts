import { test, expect } from '@playwright/test';

test('delivery portfolio chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /project delivery/i })).toBeVisible();
  await expect(page.locator('[data-testid="delivery-tiles"]')).toBeVisible();
  await expect(page.locator('[data-testid="delivery-gantt"]')).toBeVisible();
  await expect(page.locator('[data-testid="delivery-catalog"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /kanban/i })).toBeVisible();
});

test('b2b list redirects to catalog', async ({ page }) => {
  await page.goto('/crm/b2b-projects');
  if (page.url().includes('/login')) test.skip();
  await expect(page).toHaveURL(/delivery-projects/);
});
