import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const PERF_LABELS = [
  'Operating Dashboard',
  'Assignment Registry',
  'Tạo Assignment',
  'Scorecard Builder',
  'Thêm chỉ tiêu',
  'Check-in Ritual',
  'Marketing OS',
  'Campaign Control',
  'CRM Source Map',
  'Snapshot Report',
  'Policy',
];

test.describe('Performance OS Hub', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar HIỆU SUẤT and operating dashboard moat', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance');
    await expect(page.getByRole('heading', { level: 1, name: 'Operating Dashboard' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-hub-sidebar').getByText('HIỆU SUẤT', { exact: true })).toBeVisible();
    for (const label of PERF_LABELS) {
      await expect(page.locator('.kpi-hub-sidebar').getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('DATA BLOCKED')).toBeVisible();
    await expect(page.getByText('SỔ QUOTED')).toBeVisible();
  });

  test('check-in ritual locks verified P1 actual', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/check-ins?assignment=asg-p1');
    await expect(page.getByRole('heading', { level: 1, name: /Check-in Ritual/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Check-in/ }).click();
    const actual = page.locator('input').first();
    await expect(actual).toBeDisabled();
  });

  test('marketing hides ROAS without attribution', async ({ page }) => {
    await page.goto('/crm/kpi-hub/performance/marketing');
    await expect(page.getByRole('heading', { level: 1, name: 'Marketing OS' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('N/A', { exact: true })).toBeVisible();
    await expect(page.getByText('Thiếu attribution model')).toBeVisible();
  });
});
