import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import { REVOPS_NATIVE_ROUTES, REVOPS_SIDEBAR_LABELS } from './helpers/revops-full-helpers';

test.describe('RevOps full smoke (B21)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'API down');
    test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  });

  test('sidebar shows all 12 RevOps nav items', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');
    const nav = page.getByRole('navigation', { name: 'Revenue Operations' });
    for (const label of REVOPS_SIDEBAR_LABELS) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('native RevOps routes load without 404', async ({ page }) => {
    await loginAsStaff(page);
    for (const route of REVOPS_NATIVE_ROUTES) {
      const res = await page.goto(route.path);
      expect(res?.status(), `${route.path} status`).toBeLessThan(400);
      await expect(page.getByText('404', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test('route catalog hidden when prod flag off', async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG === '1', 'catalog flag on');
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');
    await expect(page.getByTestId('revops-route-catalog')).toHaveCount(0);
  });

  test('mobile bottom nav works on embed leads route', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);
    await page.goto('/crm/leads?revops=1');
    await expect(page.locator('html')).toHaveClass(/revops-embed/);
    await expect(page.getByTestId('revops-mobile-nav-leads')).toHaveClass(/is-active/);
    await page.getByTestId('revops-mobile-nav-pipeline').click();
    await expect(page).toHaveURL(/\/crm\/revenue-ops\/pipeline/);
    await expect(page.getByRole('heading', { name: /Pipeline & Deal/i })).toBeVisible();
  });

  test('mobile bottom nav works inside RevOps shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');
    await expect(page.getByTestId('revops-mobile-nav-dashboard')).toHaveClass(/is-active/);
    await page.getByTestId('revops-mobile-nav-kpi').click();
    await expect(page).toHaveURL(/\/crm\/kpi-hub\/sales\?revops=1/);
    await expect(page.locator('html')).toHaveClass(/revops-embed/);
    await expect(page.getByTestId('revops-mobile-nav-kpi')).toHaveClass(/is-active/);
  });
});
