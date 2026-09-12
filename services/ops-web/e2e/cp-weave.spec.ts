import { expect, test, type Page } from '@playwright/test';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const WO_ID = '33333333-3333-4333-8333-333333333333';

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

const WORK_ORDER = {
  id: WO_ID,
  project_id: PROJECT_ID,
  status: 'brief_ready',
  template_key: 'feed-1x1',
  task_id: 'CR-2026-0912-028',
  client_code: 'nova',
  campaign_code: 'mid-autumn-2026',
  brief_json: {
    creative_brief: 'Mid-autumn',
    prompt: 'lanterns at night',
    negative_prompt: 'blur',
    shot_list: ['hero'],
    output_format: { kind: 'image', width: 1080, height: 1080 },
  },
  assets: [],
};

async function injectStaffSession(page: Page) {
  await page.context().addCookies([
    { name: 'ptt_ops_auth', value: '1', url: 'http://127.0.0.1:3200' },
    { name: 'ptt_ops_position_code', value: 'AM', url: 'http://127.0.0.1:3200' },
  ]);
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.setItem('ptt_ops_access_token', 'weave-e2e-token');
    sessionStorage.setItem('ptt_ops_refresh_token', 'weave-e2e-token');
    sessionStorage.setItem(
      'ptt_ops_user',
      JSON.stringify({ id: 9, email: 'staff@demo.local', name: 'Staff', position_code: 'AM' }),
    );
  });
}

async function mockCpApis(page: Page) {
  await page.route('**/api/v1/staff/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 9,
        email: 'staff@demo.local',
        name: 'Staff',
        access_token: 'weave-e2e-token',
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
          magnificMcp: false,
          magnificRest: false,
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
    if (path.includes('/weave-orders') && path.endsWith('/generate-brief') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...WORK_ORDER, ai_stub: true }),
      });
    }
    if (path.includes('/weave-orders') && path.endsWith('/open') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ href: 'https://weave.figma.com/flows/feed-1x1?wo=' + WO_ID }),
      });
    }
    if (path.endsWith('/weave-orders') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(WORK_ORDER),
      });
    }
    if (path.includes('/weave-orders')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [WORK_ORDER] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

test.describe('Creative OS Weave pane', () => {
  test('shows Sync output on AI Ops weave pane and ignores tab=weave', async ({ page }) => {
    await mockCpApis(page);
    await injectStaffSession(page);
    await page.goto(`/crm/creative-os/projects/${PROJECT_ID}?tab=ai-ops&pane=weave`);
    await expect(page.getByRole('button', { name: 'Sync output' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open in Weave' })).toBeVisible();

    await page.goto(`/crm/creative-os/projects/${PROJECT_ID}?tab=weave`);
    await expect(page.getByRole('button', { name: 'Sync output' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Tổng quan|Brief|AI Ops/ })).toBeTruthy();
  });
});
