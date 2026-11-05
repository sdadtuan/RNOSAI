import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  deleteKpiTypeByCode,
  e2eKpiTypeCode,
  staffHasKpiTypesManage,
  staffHasKpiTypesView,
} from './helpers/kpi-types-helpers';

test.describe('KPI Types admin', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('list page loads summary cards and table', async ({ page, request }) => {
    test.skip(!(await staffHasKpiTypesView(request)), 'Staff lacks crm_kpi_types.view');

    await page.goto('/crm/kpi/types');
    await expect(page.getByRole('heading', { name: 'Thiết lập KPI Type' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-type-summary-grid')).toBeVisible();
    await expect(page.getByText('Tổng KPI Type')).toBeVisible();
    await expect(page.locator('.kpi-type-table, .kpi-type-empty')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('create draft MQL and search', async ({ page, request }) => {
    test.skip(!(await staffHasKpiTypesManage(request)), 'Staff lacks crm_kpi_types.manage');

    const code = e2eKpiTypeCode();
    const name = `E2E KPI Type ${code}`;

    try {
      await page.goto('/crm/kpi/types/new');
      await expect(page.getByRole('heading', { level: 1, name: 'Thêm KPI Type' })).toBeVisible({
        timeout: 20_000,
      });

      const groupSelect = page.getByLabel(/Nhóm KPI/i).first();
      const options = await groupSelect.locator('option').allTextContents();
      const firstGroup = options.find((o) => o && !o.startsWith('—'));
      test.skip(!firstGroup, 'No ACTIVE KPI group to attach');
      await groupSelect.selectOption({ label: firstGroup! });

      await page.getByLabel(/Mã KPI Type/i).fill(code);
      await page.getByLabel(/Tên KPI Type/i).fill(name);
      await page.getByLabel(/Mục tiêu mặc định/i).fill('1200');

      const unitSelect = page.getByLabel(/Đơn vị đo/i);
      const unitOptions = await unitSelect.locator('option').allTextContents();
      const firstUnit = unitOptions.find((o) => o && !o.startsWith('—'));
      if (firstUnit) await unitSelect.selectOption({ label: firstUnit });

      await page.getByRole('button', { name: 'Lưu nháp' }).click();
      await expect(page).toHaveURL(/\/crm\/kpi\/types\/[0-9a-f-]+/, { timeout: 20_000 });
      await expect(page.locator('.kpi-type-form-page__head code')).toHaveText(code);

      await page.goto('/crm/kpi/types');
      await page.getByPlaceholder('Tìm theo mã, tên, mô tả hoặc công thức...').fill(code);
      await page.getByRole('button', { name: 'Tìm' }).click();
      await expect(page.locator('.kpi-type-table').getByText(name)).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteKpiTypeByCode(request, code);
    }
  });
});
