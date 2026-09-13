import { expect, test, type Page } from '@playwright/test';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = '55555555-5555-4555-8555-555555555555';
const ASSET_ID = '66666666-6666-4666-8666-666666666666';

const PROJECT = {
  id: PROJECT_ID,
  name: 'Nova Mid-autumn',
  agency_client_id: '22222222-2222-4222-8222-222222222222',
  lifecycle_id: '44444444-4444-4444-8444-444444444444',
  owner_staff_id: 9,
  status: 'active',
  due_at: null,
  credit_budget: null,
};

const STAFF_USER = {
  id: 9,
  email: 'staff@demo.local',
  name: 'Staff',
  display_name: 'Staff',
  position_code: 'AM',
  caps: [
    { section: 'crm_cp', action: 'view' },
    { section: 'crm_cp', action: 'edit' },
    { section: 'crm_cp', action: 'render' },
  ],
};

async function injectStaffSession(page: Page) {
  await page.context().addCookies([
    { name: 'ptt_ops_auth', value: '1', url: 'http://127.0.0.1:3200' },
    { name: 'ptt_ops_position_code', value: 'AM', url: 'http://127.0.0.1:3200' },
  ]);
  await page.goto('/login');
  await page.evaluate((user) => {
    sessionStorage.setItem('ptt_ops_access_token', 'magnific-e2e-token');
    sessionStorage.setItem('ptt_ops_refresh_token', 'magnific-e2e-token');
    sessionStorage.setItem('ptt_ops_user', JSON.stringify(user));
  }, STAFF_USER);
}

async function mockCpApis(page: Page) {
  await page.route('**/api/v1/staff/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...STAFF_USER,
        access_token: 'magnific-e2e-token',
      }),
    });
  });
  await page.route('**/api/crm/cp/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/ai-ops/flags')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          weave: true,
          magnificMcp: true,
          magnificRest: true,
          comfy: false,
          showAiOpsTab: true,
        }),
      });
    }
    if (path.endsWith(`/projects/${PROJECT_ID}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PROJECT),
      });
    }
    if (path.endsWith('/jobs/draft') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: JOB_ID,
          status: 'pending_confirm',
          estimate: { credits: 12, duration_sec: 30 },
          requires_confirmation: true,
        }),
      });
    }
    if (path.includes(`/jobs/${JOB_ID}/confirm`) && method === 'POST') {
      const body = route.request().postDataJSON() as { confirm?: boolean };
      if (body?.confirm !== true) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'human_confirm_required' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: JOB_ID, state: 'pending_confirm' }),
      });
    }
    if (path.includes(`/jobs/${JOB_ID}/submit`) && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ job_id: JOB_ID, status: 'queued' }),
      });
    }
    if (path.endsWith(`/jobs/${JOB_ID}`) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: JOB_ID,
          state: 'qc',
          asset_id: ASSET_ID,
          ingested: 1,
          stage_log_json: { asset_id: ASSET_ID },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

test.describe('Creative OS Magnific pane', () => {
  test('drafts, blocks confirm without checkbox, then submit shows asset id', async ({ page }) => {
    await mockCpApis(page);
    await injectStaffSession(page);
    await page.goto(`/crm/creative-os/projects/${PROJECT_ID}?tab=ai-ops&pane=magnific`);

    await expect(page.getByTestId('cp-magnific-pane')).toBeVisible();
    await expect(page.getByTestId('cp-magnific-step-context')).toContainText('1. Kết nối');
    await expect(page.getByTestId('cp-magnific-human-route')).toContainText('Không tự đốt credit');
    await expect(page.getByRole('radio', { name: 'API' })).toBeEnabled();
    await expect(page.getByRole('radio', { name: 'MCP' })).toBeEnabled();
    await page.getByTestId('cp-magnific-prompt').fill('đèn lồng đêm Trung thu');
    await page.getByTestId('cp-magnific-draft').click();
    await expect(page.getByTestId('cp-magnific-estimate')).toContainText('12');

    await page.getByTestId('cp-magnific-submit').click();
    await expect(page.getByTestId('cp-magnific-error')).toContainText('human_confirm_required');
    await expect(page.getByTestId('cp-magnific-error')).toContainText(/xác nhận/i);

    await page.getByTestId('cp-magnific-confirm').check();
    await page.getByTestId('cp-magnific-submit').click();
    await expect(page.getByTestId('cp-magnific-asset')).toContainText(ASSET_ID);
    await expect(page.getByTestId('cp-magnific-notice')).not.toContainText('Thành công');
  });
});
