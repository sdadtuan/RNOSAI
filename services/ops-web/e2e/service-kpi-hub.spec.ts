import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const SERVICE_KPI_LABELS = [
  'War Room',
  'Service KPI Template',
  'KPI Instances',
  'Measurement Plan',
  'Actual Tracking',
  'KPI Contract & Risk',
  'Quoted vs Actual',
  'Policy Pack',
];

test.describe('Service KPI Hub', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar SERVICE KPI group and War Room route', async ({ page }) => {
    await page.goto('/crm/kpi-hub/service-kpi');
    await expect(page.getByRole('heading', { level: 1, name: 'Service KPI War Room' })).toBeVisible({
      timeout: 20_000,
    });
    const skpiSection = page.locator('.kpi-hub-sidebar').getByText('SERVICE KPI', { exact: true });
    await expect(skpiSection).toBeVisible();
    for (const label of SERVICE_KPI_LABELS) {
      await expect(page.locator('.kpi-hub-sidebar').getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('service-templates page has no iframe and shows heading', async ({ page }) => {
    await page.goto('/crm/kpi-hub/service-templates');
    await expect(page.getByRole('heading', { level: 1, name: 'Service KPI Template' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('.kpi-hub-shell')).toBeVisible();
  });

  test('policy-packs shows BĐS banned phrase', async ({ page }) => {
    await page.goto('/crm/kpi-hub/policy-packs');
    await expect(page.getByRole('heading', { level: 1, name: 'Industry Policy Pack' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Bất động sản')).toBeVisible();
    await expect(page.getByText('cam kết doanh số')).toBeVisible();
  });

  test('reconcile table has Quoted Delivered Reported columns', async ({ page }) => {
    await page.goto('/crm/kpi-hub/reconcile');
    await expect(page.getByRole('heading', { level: 1, name: 'Quoted vs Actual' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('columnheader', { name: 'Quoted' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Delivered' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reported' })).toBeVisible();
  });
});
