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

const S4_REMIND = {
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
};

const REMIND_SHIPPED = {
  factory: 'A',
  column_id: 'tmmt_deliver',
  sensor_ids: ['S7'],
  severity: 'red',
  title_vi: 'Lead #70 ops quá hạn',
  entity_type: 'lifecycle',
  entity_id: 700,
  owner_name: 'AM Demo',
  age_label: '2d',
  value_vnd: 20000000,
  department_code: 'DEPT-AGENCY',
  team_code: 'TEAM-AGENCY-OPS',
  position_code: 'KD-01',
  job_function: 'am',
  href: '/crm/hub/70',
  suggest_action: 'remind_staff',
  suggest_params: { lead_id: 70, staff_id: 3, owner_staff_id: 3 },
};

const ORG_ROLLUP = [
  { level: 'company', code: 'PTT', label_vi: 'PTT', red_count: 2, amber_count: 0 },
  { level: 'department', code: 'DEPT-SALES', label_vi: 'Kinh doanh', red_count: 2, amber_count: 0 },
  { level: 'department', code: 'DEPT-SOLUTION', label_vi: 'Solution / MKT', red_count: 0, amber_count: 0 },
  { level: 'department', code: 'DEPT-CSKH', label_vi: 'CSKH', red_count: 0, amber_count: 0 },
  { level: 'department', code: 'DEPT-AGENCY', label_vi: 'Agency', red_count: 0, amber_count: 0 },
  { level: 'department', code: 'DEPT-HR', label_vi: 'Nhân sự', red_count: 0, amber_count: 0, outside_cycle: true },
  { level: 'department', code: 'DEPT-IT', label_vi: 'IT / Admin', red_count: 0, amber_count: 0, outside_cycle: true },
  { level: 'team', code: 'TEAM-SALES-AM', label_vi: 'TEAM-SALES-AM', red_count: 2, amber_count: 0 },
];

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
    { column_id: 'tmmt_deliver', red_count: 1, amber_count: 0, ok_count: 1, header_severity: 'red' },
    { column_id: 'care', red_count: 0, amber_count: 0, ok_count: 1, header_severity: 'ok' },
  ],
  exceptions: [S4_REMIND, REMIND_SHIPPED],
  org_rollup: ORG_ROLLUP,
  next_cursor: null,
  degraded: [],
  sensors_ok: {
    S1: 'ok',
    S2: 'ok',
    S3: 'ok',
    S4: 'fail',
    S5: 'ok',
    S6: 'ok',
    S7: 'fail',
    S8: 'ok',
    S9: 'ok',
    S10: 'ok',
    S11: 'ok',
    S12: 'ok',
  },
  trends: {
    series: {
      labels: ['T3', 'T4', 'T5', 'T6', 'T7', 'CN', 'T2'],
      total_issues: [1, 1, 2, 2, 2, 3, 3],
      red_issues: [0, 1, 1, 2, 2, 2, 2],
      by_column: {
        lead_b2: [0, 0, 1, 1, 1, 1, 1],
        intake: [0, 0, 0, 0, 0, 0, 0],
        consult: [0, 0, 0, 0, 0, 0, 0],
        contract: [1, 1, 1, 1, 1, 1, 1],
        tmmt_deliver: [0, 0, 1, 1, 1, 1, 1],
        care: [0, 0, 0, 0, 0, 0, 0],
      },
    },
    wow: {
      current_total: 3,
      prev_week_total: 1,
      delta: 2,
      direction: 'up',
    },
  },
};

async function mockCeoTowerApis(
  page: import('@playwright/test').Page,
  opts?: { can_act?: boolean; filterByQuery?: boolean },
) {
  const commitPosts: string[] = [];
  const proposePosts: Array<Record<string, unknown>> = [];

  await page.route('**/api/crm/ceo/actions/commit**', async (route) => {
    commitPosts.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', result_json: {}, reused: false }),
    });
  });
  await page.route('**/api/crm/ceo/tower**', async (route) => {
    const url = new URL(route.request().url());
    let exceptions = [...TOWER_FIXTURE.exceptions];
    if (opts?.filterByQuery) {
      const department = url.searchParams.get('department');
      const team = url.searchParams.get('team');
      if (department) {
        exceptions = exceptions.filter((row) => row.department_code === department);
      }
      if (team) {
        exceptions = exceptions.filter((row) => row.team_code === team);
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...TOWER_FIXTURE, exceptions }),
    });
  });
  await page.route('**/api/crm/ceo/context**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        staff_id: 1,
        can_act: opts?.can_act !== false,
        can_configure: false,
        chips_a: [],
        chips_b: [],
        actions: [],
        llm_enabled: false,
        ceo_command_enabled: true,
      }),
    });
  });
  await page.route('**/api/crm/ceo/turns**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      if (body.intent === 'propose_action') proposePosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turn_id: 'turn-tower-1',
          thread_id: 'thread-tower-1',
          intent: body.intent ?? 'propose_action',
          reply_vi: 'Nhắc nội bộ: Lead #70 ops quá hạn?',
          stub_mode: true,
          model_name: 'stub',
          facts_json: {},
          citations: [],
          cards: [],
          degraded: [],
          proposed_action:
            body.intent === 'propose_action'
              ? {
                  action_id: body.action_id,
                  params: body.params ?? {},
                  preview_vi: 'Nhắc nội bộ: Lead #70 ops quá hạn?',
                  required_caps: [],
                  can_confirm: true,
                }
              : null,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ turns: [] }),
    });
  });

  return { commitPosts, proposePosts };
}

test.describe('CEO Lifecycle Tower T1', () => {
  test('shows 6 columns; viewing and Mở do not POST commit', async ({ page }) => {
    const { commitPosts } = await mockCeoTowerApis(page);

    await loginAsStaff(page);
    await page.goto('/crm/ceo');

    await expect(page.getByTestId('ceo-lifecycle-tower')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ceo-tower-queue')).toHaveAttribute('data-can-act', 'yes');
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
    await expect(page.getByTestId('ceo-tower-trends')).toBeVisible();
    await expect(page.getByTestId('ceo-tower-wow')).toContainText('+2');
    await expect(page.getByTestId('ceo-tower-health-wow')).toContainText('+2');
    await expect(page.getByTestId('ceo-tower-dept-donut')).toBeVisible();

    await page.getByTestId('ceo-tower-column-contract').click();
    await expect(page).toHaveURL(/\/crm\/ceo/);
    await expect(page).toHaveURL(/column_id=contract/);
    await expect(page).toHaveURL(/severity=red%2Camber|severity=red,amber/);

    const openLink = page.getByRole('link', { name: 'Mở' }).first();
    await expect(openLink).toHaveAttribute('href', /lead-contract|\/crm\/hub/);

    const suggestS4 = page.getByRole('button', { name: 'Gợi ý' }).first();
    await expect(suggestS4).toBeEnabled();
    expect(commitPosts).toHaveLength(0);

    await openLink.click();
    expect(commitPosts).toHaveLength(0);
  });
});

test.describe('CEO Lifecycle Tower T2', () => {
  test('Gợi ý with can_act proposes then confirms commit', async ({ page }) => {
    const { commitPosts, proposePosts } = await mockCeoTowerApis(page, { can_act: true });

    await loginAsStaff(page);
    await page.goto('/crm/ceo');

    await expect(page.getByTestId('ceo-lifecycle-tower')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ceo-tower-queue')).toHaveAttribute('data-can-act', 'yes');
    const suggestButtons = page.getByRole('button', { name: 'Gợi ý' });
    await expect(suggestButtons).toHaveCount(2);
    await suggestButtons.nth(1).click();

    await expect(page.getByRole('heading', { name: 'Xác nhận hành động' })).toBeVisible();
    expect(proposePosts).toEqual([
      expect.objectContaining({
        intent: 'propose_action',
        action_id: 'remind_staff',
        params: expect.objectContaining({
          staff_id: 3,
          title: 'Lead #70 ops quá hạn',
          body: 'Lead #70 ops quá hạn',
          link_href: '/crm/hub/70',
        }),
      }),
    ]);
    expect(commitPosts).toHaveLength(0);

    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await expect.poll(() => commitPosts.length).toBe(1);
  });

  test('hides Gợi ý when can_act is false', async ({ page }) => {
    const { commitPosts } = await mockCeoTowerApis(page, { can_act: false });

    await loginAsStaff(page);
    await page.goto('/crm/ceo');

    await expect(page.getByTestId('ceo-lifecycle-tower')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ceo-tower-queue')).toHaveAttribute('data-can-act', 'no');
    await expect(page.getByRole('link', { name: 'Mở' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gợi ý' })).toHaveCount(0);
    expect(commitPosts).toHaveLength(0);
  });
});

test.describe('CEO Lifecycle Tower T4', () => {
  test('Sales dept → TEAM-SALES-AM filters queue rows', async ({ page }) => {
    await mockCeoTowerApis(page, { filterByQuery: true });

    await loginAsStaff(page);
    await page.goto('/crm/ceo');

    await expect(page.getByTestId('ceo-lifecycle-tower')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ceo-tower-dept-DEPT-SALES')).toBeVisible();

    await page.getByTestId('ceo-tower-dept-DEPT-SALES').click();
    await expect(page).toHaveURL(/department=DEPT-SALES/);
    await expect(page.getByTestId('ceo-tower-breadcrumb')).toContainText('Kinh doanh');

    await page.getByTestId('ceo-tower-breadcrumb-clear').click();
    await expect(page).not.toHaveURL(/department=/);

    await page.goto('/crm/ceo?department=DEPT-SALES&team=TEAM-SALES-AM');
    await expect(page.getByTestId('ceo-tower-breadcrumb')).toContainText('TEAM-SALES-AM');
    await expect(page.getByRole('cell', { name: 'HĐ #42 chờ duyệt 36h' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Lead #70 ops quá hạn' })).toHaveCount(0);

    await page.goto('/crm/ceo?department=DEPT-HR');
    await expect(page.getByTestId('ceo-tower-outside-cycle-empty')).toContainText(
      'Không theo dõi trên tháp',
    );
  });
});
