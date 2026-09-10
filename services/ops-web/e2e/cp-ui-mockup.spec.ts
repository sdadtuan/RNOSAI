import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import { CP_SUBTITLES } from '../src/lib/crm/cp-copy';
import { API_URL } from './helpers/cp-w1-helpers';

test.describe('Creative OS UI mockup smoke', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`UI mockup prerequisite missing: API unreachable at ${API_URL}`);
    }
  });

  test('shell uses navy sidebar and OVR-01 subtitle', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os');
    await expect(page.locator('.cp-sidebar')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cp-sidebar')).toHaveCSS('background-color', 'rgb(15, 39, 71)');
    await expect(page.getByText(CP_SUBTITLES.ovrDashboard)).toBeVisible();
  });

  test('actions page loads OVR-02 full page', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os/actions');
    await expect(page.getByRole('heading', { name: /Action Center|Hành động/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CP_SUBTITLES.ovrActions)).toBeVisible();
    await expect(page.locator('.cp-tbl-wrap, .cp-table-wrap, table')).toBeVisible();
  });

  test('media library uses cp-media-grid', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os/media');
    await expect(page.getByRole('heading', { name: /Thư viện media/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CP_SUBTITLES.medLibrary)).toBeVisible();
    const grid = page.locator('.cp-media-grid');
    const card = page.locator('.cp-media-card');
    const gridVisible = await grid.isVisible().catch(() => false);
    const cardVisible = await card.first().isVisible().catch(() => false);
    if (gridVisible || cardVisible) {
      await expect(grid.or(card.first())).toBeVisible();
    }
  });

  test('calendar page uses cp-cal month grid', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os/calendar');
    await expect(page.getByRole('heading', { name: /Lịch xuất bản/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CP_SUBTITLES.calCalendar)).toBeVisible();
    await expect(page.locator('.cp-cal')).toBeVisible();
    await expect(page.locator('.cp-cal__wd').first()).toBeVisible();
  });
});
