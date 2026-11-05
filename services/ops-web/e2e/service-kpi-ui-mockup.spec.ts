import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const ROUTES: Array<{ path: string; subtitleFragment: string }> = [
  { path: '/crm/kpi-hub/service-kpi', subtitleFragment: 'SKPI-00 · Nhịp vận hành tuần' },
  { path: '/crm/kpi-hub/service-kpi/overview', subtitleFragment: 'SKPI-00 · Dashboard vận hành' },
  { path: '/crm/kpi-hub/service-templates', subtitleFragment: 'SKPI-01 · Cấu hình bộ KPI' },
  { path: '/crm/kpi-hub/instances', subtitleFragment: 'SKPI-03 · KPI kế thừa' },
  { path: '/crm/kpi-hub/measurement', subtitleFragment: 'SKPI-05 · Kế hoạch đo' },
  { path: '/crm/kpi-hub/tracking', subtitleFragment: 'SKPI-06 · Ghi nhận actual' },
  { path: '/crm/kpi-hub/kpi-contracts', subtitleFragment: 'SKPI-09 · Điểm rủi ro' },
  { path: '/crm/kpi-hub/reconcile', subtitleFragment: 'SKPI-10 · Ba sổ' },
  { path: '/crm/kpi-hub/policy-packs', subtitleFragment: 'SKPI-11 · Rule + từ cấm' },
];

test.describe('Service KPI UI mockup alignment', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  for (const route of ROUTES) {
    test(`subtitle on ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByText(route.subtitleFragment)).toBeVisible({ timeout: 20_000 });
    });
  }

  test('War Room shows moat notice', async ({ page }) => {
    await page.goto('/crm/kpi-hub/service-kpi');
    await expect(page.getByText('AgencyAnalytics thấy health KPI')).toBeVisible({ timeout: 20_000 });
  });

  test('Reconcile nav label and success banner', async ({ page }) => {
    await page.goto('/crm/kpi-hub/reconcile');
    await expect(page.getByRole('heading', { level: 1, name: 'Quoted vs Delivered vs Reported' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Quoted = snapshot pháp lý')).toBeVisible();
    await page.goto('/crm/kpi-hub/service-kpi');
    await expect(page.locator('.kpi-hub-sidebar').getByText('Quoted vs Delivered vs Reported')).toBeVisible();
  });
});
