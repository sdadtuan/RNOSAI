import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-41 — PWA + mobile lead list smoke.
 */
test.describe('RNOS-41 PWA', () => {
  test('manifest and service worker assets are served', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const body = (await manifest.json()) as { name?: string; start_url?: string };
    expect(body.name).toContain('PTT CRM');
    expect(body.start_url).toBe('/crm/leads');

    const sw = await request.get('/sw.js');
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain('ptt-ops-pwa-v1');

    const icon = await request.get('/icons/icon.svg');
    expect(icon.ok()).toBeTruthy();
  });

  test('mobile lead list shows cards instead of table', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable — start ptt-crm-api for auth');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm/leads');

    await expect(page.getByText(/leads · trang/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.crm-leads-cards')).toBeVisible();
    await expect(page.locator('.crm-leads-table-wrap')).toBeHidden();
  });
});
