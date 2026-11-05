import { test, expect } from '@playwright/test';

test.describe('IWR W5', () => {
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
          ],
        },
      });
    });
    await page.route('**/api/crm/iwr/saved-reports', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            items: [
              {
                id: 'sr1',
                name_vi: 'BC tuần',
                owner_staff_id: 2,
                query_json: { template_codes: ['daily_work'] },
                viz: 'table',
                shared_staff_ids: [],
              },
            ],
          },
        });
        return;
      }
      await route.continue();
    });
    await page.route('**/api/crm/iwr/saved-reports/*/run', async (route) => {
      await route.fulfill({
        json: {
          rows: [
            {
              id: 'r1',
              title: 'Báo cáo ngày',
              author_name: 'NV A',
              period_start: '2026-09-01',
              status: 'submitted',
              rag: 'green',
            },
          ],
          truncated: false,
        },
      });
    });
  });

  test('builder page lists saved reports and run result', async ({ page }) => {
    await page.goto('/crm/internal-reports/builder');
    await expect(page.getByTestId('iwr-builder-list')).toContainText('BC tuần');
    await page.getByRole('button', { name: 'Chạy' }).click();
    await expect(page.getByTestId('iwr-builder-run')).toContainText('Báo cáo ngày');
  });
});
