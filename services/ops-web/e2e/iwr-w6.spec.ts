import { test, expect } from '@playwright/test';

test.describe('IWR W6', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staff/me', async (route) => {
      await route.fulfill({
        json: {
          id: '2',
          email: 'leader@demo.local',
          display_name: 'Leader',
          caps: [
            { section: 'iwr', action: 'view' },
            { section: 'iwr', action: 'external' },
          ],
        },
      });
    });
    await page.route('**/api/crm/iwr/ai/status', async (route) => {
      await route.fulfill({ json: { enabled: false } });
    });
    await page.route('**/api/crm/iwr/reports/*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        json: {
          id: 'r1',
          title: 'BC ngày',
          template_code: 'daily_work',
          template_name_vi: 'Báo cáo ngày',
          template_id: 't1',
          author_staff_id: 2,
          reviewer_staff_id: 1,
          period_start: '2026-09-01',
          period_end: '2026-09-01',
          due_at: '2026-09-01',
          status: 'submitted',
          version: 'v1.0',
          rag: 'green',
          is_late: false,
          late_reason: null,
          first_viewed_at: null,
          submitted_at: '2026-09-01T10:00:00Z',
          acknowledged_at: null,
          sections_json: { done: { body: 'ok', items: [] } },
          recipients: [],
          comments: [],
          versions: [],
        },
      });
    });
    await page.route('**/api/crm/iwr/reports/*/comments', async (route) => {
      await route.fulfill({ json: { items: [] } });
    });
    await page.route('**/api/crm/iwr/reports/*/viewed', async (route) => {
      await route.fulfill({ json: { first_viewed_at: '2026-09-01T10:00:00Z' } });
    });
  });

  test('report page hides AI button when LLM disabled', async ({ page }) => {
    await page.goto('/crm/internal-reports/r1');
    await expect(page.getByTestId('iwr-ai-summarize')).toHaveCount(0);
  });

  test('inbox layout serves IWR PWA manifest link', async ({ page }) => {
    await page.route('**/api/crm/iwr/inbox**', async (route) => {
      await route.fulfill({ json: { items: [] } });
    });
    await page.goto('/crm/internal-reports/inbox');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('/iwr-manifest.json');
  });
});
