import { test, expect } from '@playwright/test';

test.describe('IWR W4', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staff/me', async (route) => {
      await route.fulfill({
        json: {
          id: '2',
          email: 'leader@demo.local',
          display_name: 'Leader',
          caps: [
            { section: 'iwr', action: 'view' },
            { section: 'iwr', action: 'review' },
            { section: 'iwr', action: 'schedule' },
          ],
        },
      });
    });
    await page.route('**/api/crm/iwr/dashboards/**', async (route) => {
      await route.fulfill({
        json: { submitted: 5, missing: 1, late: 0, action_needed: 2, rag_red: 0, open_blockers: 1 },
      });
    });
    await page.route('**/api/crm/iwr/schedules', async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: 's1',
              kind: 'precreate',
              cron_expr: '0 6 * * *',
              timezone: 'Asia/Ho_Chi_Minh',
              channel: 'in_app',
              active: true,
              next_run_at: null,
            },
          ],
        },
      });
    });
  });

  test('dashboards page loads leader metrics', async ({ page }) => {
    await page.goto('/crm/internal-reports/dashboards?role=leader');
    await expect(page.getByTestId('iwr-dashboard')).toContainText('submitted');
  });

  test('schedules page lists worker kinds', async ({ page }) => {
    await page.goto('/crm/internal-reports/schedules');
    await expect(page.getByTestId('iwr-schedules')).toContainText('precreate');
  });
});
