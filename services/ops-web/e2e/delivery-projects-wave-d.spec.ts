import { test, expect } from '@playwright/test';

test('dictionary picker chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects/new?step=5');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('button', { name: /Thêm KPI từ Dictionary/i })).toBeVisible();
});

test('dictionary add route renders picker filters', async ({ page }) => {
  await page.goto('/crm/delivery-projects/00000000-0000-4000-8000-000000000099/kpis/add');
  if (page.url().includes('/login')) test.skip();
  await expect(page.locator('[data-testid="dict-picker-filter"]')).toBeVisible();
  await expect(page.locator('[data-testid="dict-picker-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="dict-picker-rail"]')).toBeVisible();
});
