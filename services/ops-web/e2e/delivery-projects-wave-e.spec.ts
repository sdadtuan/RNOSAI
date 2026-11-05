import { test, expect } from '@playwright/test';

test('risk register route', async ({ page }) => {
  await page.goto('/crm/delivery-projects/risks');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /risk register/i })).toBeVisible();
  await expect(page.locator('[data-testid="delivery-risk-register"]')).toBeVisible();
});

test('capacity planning route', async ({ page }) => {
  await page.goto('/crm/delivery-projects/capacity');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /capacity planning/i })).toBeVisible();
  await expect(page.locator('[data-testid="delivery-capacity-panel"]')).toBeVisible();
});

test('delivery quality route', async ({ page }) => {
  await page.goto('/crm/delivery-projects/quality');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /delivery quality/i })).toBeVisible();
});

test('approval center loads groups', async ({ page }) => {
  await page.goto('/crm/kpi-hub/approvals');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: 'Approval Center' })).toBeVisible();
  await expect(page.locator('[data-testid="hub-approvals"]')).toBeVisible();
});

test('kpi lineage route', async ({ page }) => {
  await page.goto('/crm/kpi-hub/lineage?code=SAL_008');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /KPI Lineage/i })).toBeVisible();
  await expect(page.locator('[data-testid="kpi-lineage"]')).toBeVisible();
});

test('portfolio wave e CTAs', async ({ page }) => {
  await page.goto('/crm/delivery-projects');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('link', { name: /Xem Risk Register/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Xem Capacity Planning/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Xem Delivery Quality/i })).toBeVisible();
});
