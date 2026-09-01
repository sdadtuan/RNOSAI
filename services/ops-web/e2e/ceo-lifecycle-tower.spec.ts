import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\//);
}

const TOWER_FIXTURE = {
  ok: true,
  generated_at: '2026-09-01T00:00:00.000Z',
  window_exception_days: 7,
  k_strip: [
    { key: 'k1', value: 120, status: 'green', href: '/crm/owner-weekly' },
    { key: 'k2', value: 4, status: 'amber', href: '/crm/owner-weekly' },
    { key: 'k3', value: 14, status: 'red', href: '/crm/owner-weekly' },
    { key: 'k4', value: 90, status: 'green', href: '/crm/owner-weekly' },
  ],
  columns: [
    { column_id: 'lead_b2', red_count: 0, amber_count: 1, ok_count: 2, header_severity: 'amber' },
    { column_id: 'intake', red_count: 0, amber_count: 0, ok_count: 1, header_severity: 'ok' },
    { column_id: 'consult', red_count: 0, amber_count: 0, ok_count: 1, header_severity: 'ok' },
    { column_id: 'contract', red_count: 1, amber_count: 0, ok_count: 0, header_severity: 'red' },
    { column_id: 'tmmt_deliver', red_count: 0, amber_count: 0, ok_count: 1, header_severity: 'ok' },
    { column_id: 'care', red_count: 0, amber_count: 0, ok_count: 1, header_severity: 'ok' },
  ],
  exceptions: [
    {
      factory: 'A',
      column_id: 'contract',
      sensor_ids: ['S4'],
      severity: 'red',
      title_vi: 'HĐ #42 chờ duyệt 36h',
      entity_type: 'lead',
      entity_id: 42,
      owner_name: 'AM Demo',
      age_label: '36h',
      value_vnd: 10000000,
      department_code: 'DEPT-SALES',
      team_code: 'TEAM-SALES-AM',
      position_code: 'KD-01',
      job_function: 'am',
      href: '/crm/leads/42#lead-contract',
      suggest_action: 'remind_contract_approval',
      suggest_params: { lead_id: 42 },
    },
  ],
  org_rollup: [],
  next_cursor: null,
  degraded: [],
  sensors_ok: {
    S1: 'ok',
    S2: 'ok',
    S3: 'ok',
    S4: 'fail',
    S5: 'ok',
    S6: 'ok',
    S7: 'ok',
    S8: 'ok',
    S9: 'ok',
    S10: 'ok',
    S11: 'ok',
    S12: 'ok',
  },
};

test.describe('CEO Lifecycle Tower T1', () => {
  test('shows 6 columns; Gợi ý does not POST commit', async ({ page }) => {
    const commitPosts: string[] = [];
    await page.route('**/api/crm/ceo/actions/commit**', async (route) => {
      commitPosts.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', result_json: {}, reused: false }),
      });
    });
    await page.route('**/api/crm/ceo/tower**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TOWER_FIXTURE),
      });
    });

    await loginAsStaff(page);
    await page.goto('/crm/ceo');

    await expect(page.getByTestId('ceo-lifecycle-tower')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ceo-tower-column-lead_b2')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-column-intake')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-column-consult')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-column-contract')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-column-tmmt_deliver')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-column-care')).toBeVisible();
    await expect(page.getByRole('button', { name: /Lead\/B2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Intake/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tư vấn/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /HĐ/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /TMMT\/QA/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /CSKH/ })).toBeVisible();

    await page.getByTestId('ceo-tower-column-contract').click();
    await expect(page).toHaveURL(/\/crm\/ceo/);
    await expect(page).toHaveURL(/column_id=contract/);
    await expect(page).toHaveURL(/severity=red%2Camber|severity=red,amber/);

    const openLink = page.getByRole('link', { name: 'Mở' }).first();
    await expect(openLink).toHaveAttribute('href', /lead-contract|\/crm\/hub/);

    await page.getByRole('button', { name: 'Gợi ý' }).first().click();
    expect(commitPosts).toHaveLength(0);
  });
});
