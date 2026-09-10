import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import { API_URL, staffToken } from './helpers/cp-w1-helpers';

test.describe('Creative OS Playbook Phase A smoke', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Phase A prerequisite missing: API unreachable at ${API_URL}`);
    }
  });

  test('playbooks API lists 3 industry templates', async ({ request }) => {
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/crm/cp/playbooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `GET playbooks: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as Array<{ id: string; qc_pack: string }> | { items?: Array<{ id: string; qc_pack: string }> };
    const items = Array.isArray(body) ? body : body.items ?? [];
    expect(items.length).toBeGreaterThanOrEqual(3);
    const ids = items.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining(['bds_social_916', 'lead_social_916', 'tvc_short_169']));
  });

  test('creative-os actions page loads OVR-02 shell', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os/actions');
    await expect(page.getByRole('heading', { name: /Action Center|Hành động/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cp-tbl-wrap, .cp-table-wrap, table')).toBeVisible();
  });

  test('video list shows playbook picker on empty drafts', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/creative-os/video');
    await expect(page.getByRole('heading', { name: /Video drafts/i })).toBeVisible({ timeout: 15_000 });
    const picker = page.getByLabel(/Chọn Industry Playbook/i);
    const table = page.locator('.cp-table tbody tr');
    const rowCount = await table.count();
    if (rowCount <= 1) {
      await expect(picker).toBeVisible();
    }
  });

  test('RE project handoff button visible when crm_cp.edit', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/re-projects/1');
    const handoff = page.getByRole('button', { name: /Tạo creative pack BĐS/i });
    const visible = await handoff.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No RE fixture or missing crm_cp.edit cap');
    }
    await expect(handoff).toBeEnabled();
  });
});
