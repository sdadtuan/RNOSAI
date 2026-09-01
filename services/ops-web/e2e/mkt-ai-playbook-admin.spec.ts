import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken, API_URL } from './helpers/ai-copilot-helpers';

type PlaybookListItem = {
  service_slug: string;
  corpus?: {
    candidate_count?: number;
    can_learn?: boolean;
    remaining?: number;
  };
};

/**
 * P2 — Admin Playbook DV: list, mở slug, Sinh disabled khi chưa đủ HĐ (fixture 0 ứng viên).
 */
test.describe('MKT-AI Playbook Admin', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('staff approve — list, mở slug, Sinh disabled khi 0 HĐ', async ({ page, request }) => {
    const token = await staffToken(request);
    const listRes = await request.get(`${API_URL}/api/v1/admin/mkt-ai/playbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if ([404, 503].includes(listRes.status())) {
      test.skip(true, 'MKT-AI playbook admin API not ready (DDL/policy missing)');
    }
    expect(listRes.ok(), `playbooks list: ${listRes.status()}`).toBeTruthy();

    const listBody = (await listRes.json()) as { items?: PlaybookListItem[] };
    const items = listBody.items ?? [];
    test.skip(items.length === 0, 'No playbook catalog rows — seed mkt_ai_service_policy first');

    const zeroCandidate =
      items.find((item) => (item.corpus?.candidate_count ?? 0) === 0) ?? items[0]!;
    const slug = zeroCandidate.service_slug;
    const canLearn = zeroCandidate.corpus?.can_learn ?? false;

    await page.goto('/crm/admin/mkt-ai/playbooks');
    await expect(page.getByRole('heading', { name: /Playbook dịch vụ/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.getByText(/\d\/5 · \d\/3/)).toBeVisible();

    const openRow = page.locator('tr', { has: page.locator(`text=${slug}`) });
    await expect(openRow).toBeVisible();
    await openRow.getByRole('button', { name: /^Mở$/i }).click();
    await expect(page).toHaveURL(new RegExp(`slug=${encodeURIComponent(slug).replace(/-/g, '\\-')}`));

    const sinhBtn = page.getByRole('button', {
      name: /Còn \d+ HĐ…|Sinh playbook từ HĐ thực chiến/i,
    });
    await expect(sinhBtn).toBeVisible({ timeout: 15_000 });

    if (!canLearn) {
      await expect(sinhBtn).toBeDisabled();
      await expect(sinhBtn).toHaveText(/Còn \d+ HĐ…/);
    }
  });
});
