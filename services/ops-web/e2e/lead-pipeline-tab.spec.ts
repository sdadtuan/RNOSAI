import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Lead Pipeline tab', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'API down');
    test.skip(process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB !== '1', 'flag off');
    await loginAsStaff(page);
  });

  test('AC-TAB-001 default tab B2B', async ({ page }) => {
    await page.goto('/crm/leads');
    await page.locator('a[href*="/crm/leads/"]').first().click();
    await expect(page.getByRole('tab', { name: 'Pipeline bán hàng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#funnel-presales')).toHaveCount(0);
  });

  test('AC-TAB-004 hash b2', async ({ page }) => {
    await page.goto('/crm/leads');
    const href = await page.locator('a[href*="/crm/leads/"]').first().getAttribute('href');
    test.skip(!href, 'no lead');
    await page.goto(`${href}#funnel-b2`);
    await expect(page.getByRole('tab', { name: 'Pipeline bán hàng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Liên hệ').first()).toBeVisible();
  });

  test('AC-TAB-006 contract tab', async ({ page }) => {
    await page.goto('/crm/leads');
    const href = await page.locator('a[href*="/crm/leads/"]').first().getAttribute('href');
    test.skip(!href, 'no lead');
    await page.goto(href!);
    await page.getByRole('tab', { name: 'Hợp đồng & Chốt' }).click();
    await expect(
      page.locator('#lead-contract-amount, .lead-contract, .deal-room-entry-banner, .lead-contract-tab').first(),
    ).toBeVisible();
  });
});
