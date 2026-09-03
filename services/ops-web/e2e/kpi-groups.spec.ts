import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  deleteKpiGroupByCode,
  e2eKpiGroupCode,
  staffHasKpiGroupsManage,
  staffHasKpiGroupsView,
} from './helpers/kpi-groups-helpers';

/**
 * KPI Groups — list, create draft, activate, filter/search smoke.
 */
test.describe('KPI Groups admin', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('list page loads summary cards and table', async ({ page, request }) => {
    test.skip(!(await staffHasKpiGroupsView(request)), 'Staff lacks crm_kpi_groups.view');

    await page.goto('/crm/kpi/groups');
    await expect(page.getByRole('heading', { level: 2, name: 'Nhóm KPI' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-group-summary-grid')).toBeVisible();
    await expect(page.getByText('Tổng nhóm KPI')).toBeVisible();
    await expect(page.locator('.kpi-group-table, .kpi-group-empty')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('create draft, activate, and filter by search', async ({ page, request }) => {
    test.skip(!(await staffHasKpiGroupsManage(request)), 'Staff lacks crm_kpi_groups.manage');

    const code = e2eKpiGroupCode();
    const name = `E2E Nhóm KPI ${code}`;

    try {
      await page.goto('/crm/kpi/groups/new');
      await expect(page.getByRole('heading', { level: 1, name: 'Thêm Nhóm KPI' })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByLabel(/Mã nhóm KPI/i).fill(code);
      await page.getByLabel(/Tên nhóm KPI/i).fill(name);
      await page.getByRole('button', { name: 'Lưu nháp' }).click();

      await expect(page).toHaveURL(/\/crm\/kpi\/groups\/[0-9a-f-]+/, { timeout: 20_000 });
      await expect(page.locator('.kpi-group-form-page__head code')).toHaveText(code);
      await expect(page.locator('.kpi-group-form-page__head').getByText('Bản nháp')).toBeVisible();

      await page.getByRole('button', { name: 'Lưu & Kích hoạt' }).click();
      await expect(page.locator('.kpi-group-form-page__head').getByText('Đang hoạt động')).toBeVisible({
        timeout: 15_000,
      });

      await page.goto('/crm/kpi/groups');
      await page.getByPlaceholder('Tìm theo mã, tên hoặc mô tả...').fill(code);
      await page.getByRole('button', { name: 'Tìm' }).click();

      await expect(page.locator('.kpi-group-table').getByText(name)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.kpi-group-table').getByText('Đang hoạt động')).toBeVisible();
    } finally {
      await deleteKpiGroupByCode(request, code);
    }
  });
});
