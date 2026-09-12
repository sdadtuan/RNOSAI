import { expect, test, type Page, type Request } from '@playwright/test';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

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
    { section: 'crm_cp', action: 'manage' },
  ],
};

const GPU_BUILDING = { comfy: { ok: false, reason: 'gpu_building' } };

async function injectStaffSession(page: Page) {
  await page.context().addCookies([
    { name: 'ptt_ops_auth', value: '1', url: 'http://127.0.0.1:3200' },
    { name: 'ptt_ops_position_code', value: 'AM', url: 'http://127.0.0.1:3200' },
  ]);
  await page.goto('/login');
  await page.evaluate((user) => {
    sessionStorage.setItem('ptt_ops_access_token', 'comfy-e2e-token');
    sessionStorage.setItem('ptt_ops_refresh_token', 'comfy-e2e-token');
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
        access_token: 'comfy-e2e-token',
      }),
    });
  });
  await page.route('**/api/crm/cp/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/ai-ops/flags')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          weave: true,
          magnificMcp: false,
          magnificRest: false,
          comfy: true,
          showAiOpsTab: true,
        }),
      });
    }
    if (path.endsWith('/provider-health')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(GPU_BUILDING),
      });
    }
    if (path.endsWith(`/projects/${PROJECT_ID}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PROJECT),
      });
    }
    if (path.endsWith('/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locale: 'vi-VN',
          timezone: 'Asia/Ho_Chi_Minh',
          default_brand_kit_id: null,
          retention_days: 365,
          signed_url_ttl_min: 15,
          restore_days: 30,
          legal_hold: false,
          soft_alert_pct: 80,
          hard_cap_pct: 100,
          high_cost_threshold: 200,
          concurrent_slots: 5,
          watermark_draft: true,
          ai_enabled: false,
          publish_native: false,
          models_json: [],
          policy_json: {},
        }),
      });
    }
    if (path.endsWith('/provider-connections')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

function collectPort8188(page: Page): Request[] {
  const leaked: Request[] = [];
  page.on('request', (request) => {
    if (request.url().includes(':8188') || /COMFYUI_GATEWAY/i.test(request.url())) {
      leaked.push(request);
    }
  });
  return leaked;
}

test.describe('Creative OS Comfy pane', () => {
  test('disables Submit when GPU is building and never leaks :8188', async ({ page }) => {
    const leaked = collectPort8188(page);
    await mockCpApis(page);
    await injectStaffSession(page);
    await page.goto(`/crm/creative-os/projects/${PROJECT_ID}?tab=ai-ops&pane=comfy`);

    await expect(page.getByTestId('cp-comfy-pane')).toBeVisible();
    await expect(page.getByTestId('cp-comfy-locked')).toHaveText('Đang xây GPU — chưa nhận job.');
    await expect(page.getByTestId('cp-comfy-submit')).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('/crm/aco');
    await expect(page.getByTestId('cp-comfy-pane')).not.toContainText(':8188');
    await expect(page.getByTestId('cp-comfy-pane')).not.toContainText('COMFYUI_GATEWAY');

    const html = await page.content();
    expect(html).not.toMatch(/:8188|COMFYUI_GATEWAY/i);
    expect(leaked).toEqual([]);
  });

  test('shows GPU chưa sẵn sàng on Settings and keeps gateway off the composer', async ({ page }) => {
    const leaked = collectPort8188(page);
    await mockCpApis(page);
    await injectStaffSession(page);
    await page.goto('/crm/creative-os/settings?tab=integrations');

    await expect(page.getByTestId('cp-settings-comfy')).toBeVisible();
    await expect(page.getByTestId('cp-settings-comfy')).toContainText('GPU chưa sẵn sàng');
    await expect(page.getByTestId('cp-settings-comfy-gateway')).toBeVisible();
    await expect(page.getByTestId('cp-settings-comfy-gateway')).toHaveValue('');
    await expect(page.getByTestId('cp-comfy-pane')).toHaveCount(0);

    const html = await page.content();
    expect(html).not.toMatch(/:8188|COMFYUI_GATEWAY/i);
    expect(leaked).toEqual([]);
  });
});
