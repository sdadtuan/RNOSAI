import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

test.describe('RNOS-09/10 Deal score + NBA', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/sales funnel tab shows pipeline kanban', async ({ page }) => {
    await page.goto('/crm/sales');
    await page.getByRole('button', { name: 'Funnel' }).click();
    await expect(page.locator('.sales-pipeline-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.sales-pipeline-kanban')).toBeVisible();
  });

  test('API — POST /api/v1/ai/score/deal validates deal_id', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.post(`${API_URL}/api/v1/ai/score/deal`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { deal_id: 999999, force: true },
    });
    if (res.status() === 503) {
      test.skip(true, 'ai_scores DDL not ready');
    }
    expect([200, 404]).toContain(res.status());
  });
});
