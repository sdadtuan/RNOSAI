import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const HUB_NAV_LABELS = [
  'Dashboard',
  'KPI Dictionary',
  'Target & Cảnh báo',
  'Nguồn dữ liệu',
  'Data Quality',
  'Báo cáo',
  'Cài đặt',
];

test.describe('KPI Hub chrome', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('ops nav KPI Hub section and executive redirect', async ({ page }) => {
    await page.goto('/crm/kpi-hub');
    await expect(page).toHaveURL(/\/crm\/kpi-hub\/executive/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Executive Command Center' })).toBeVisible({
      timeout: 20_000,
    });
    const kpiSection = page.locator('.ops-nav-group').filter({ hasText: 'KPI Hub' });
    await expect(kpiSection).toBeVisible();
    for (const label of HUB_NAV_LABELS) {
      await expect(kpiSection.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('.kpi-hub-embed .kpi-hub-sidebar')).toBeVisible();
    await expect(page.locator('[data-testid="exec-kpi-tiles"]')).toBeVisible();
    await expect(page.locator('.kpi-hub-freshness')).toBeVisible();
  });

  test('dictionary list has + Tạo KPI', async ({ page }) => {
    await page.goto('/crm/kpi-hub/dictionary');
    await expect(page.getByRole('heading', { level: 1, name: 'KPI Dictionary' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: '+ Tạo KPI' })).toBeVisible();
    await expect(page.getByText('MKT_006')).toBeVisible();
  });

  test('targets page title', async ({ page }) => {
    await page.goto('/crm/kpi-hub/targets');
    await expect(page.getByRole('heading', { level: 1, name: 'Target & Cảnh báo' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('settings workspace nav', async ({ page }) => {
    await page.goto('/crm/kpi-hub/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Không gian làm việc')).toBeVisible();
  });

  test('all hub URLs load shell', async ({ page }) => {
    const urls = [
      '/crm/kpi-hub',
      '/crm/kpi-hub/dictionary',
      '/crm/kpi-hub/targets',
      '/crm/kpi-hub/sources',
      '/crm/kpi-hub/quality',
      '/crm/kpi-hub/reports',
      '/crm/kpi-hub/settings',
    ];
    for (const url of urls) {
      await page.goto(url);
      await expect(page.locator('.kpi-hub-shell')).toBeVisible({ timeout: 20_000 });
    }
  });
});
