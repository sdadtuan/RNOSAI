import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test('sidebar Command Center active', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops');
  await expect(page.getByRole('navigation').getByText('Command Center')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales & Account Command Center' })).toBeVisible();
});
