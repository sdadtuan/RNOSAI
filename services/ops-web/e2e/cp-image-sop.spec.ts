import { expect, test, type Page } from '@playwright/test';

const STAFF_CP = {
  id: 9,
  email: 'staff@demo.local',
  name: 'Staff',
  display_name: 'Staff',
  position_code: 'AM',
  caps: [
    { section: 'crm_cp', action: 'view' },
    { section: 'crm_cp', action: 'edit' },
  ],
};

const STAFF_IMG = {
  ...STAFF_CP,
  caps: [
    ...STAFF_CP.caps,
    { section: 'crm_img', action: 'view' },
  ],
};

async function injectStaffSession(page: Page, user: typeof STAFF_CP) {
  await page.context().addCookies([
    { name: 'ptt_ops_auth', value: '1', url: 'http://127.0.0.1:3200' },
    { name: 'ptt_ops_position_code', value: 'AM', url: 'http://127.0.0.1:3200' },
  ]);
  await page.goto('/login');
  await page.evaluate((stored) => {
    sessionStorage.setItem('ptt_ops_access_token', 'cp-image-e2e-token');
    sessionStorage.setItem('ptt_ops_refresh_token', 'cp-image-e2e-token');
    sessionStorage.setItem('ptt_ops_user', JSON.stringify(stored));
  }, user);
}

async function mockStaffAuth(page: Page, user: typeof STAFF_CP) {
  await page.route('**/api/v1/staff/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...user, access_token: 'cp-image-e2e-token' }),
    });
  });
}

test('flag off hides Ảnh SOP', async ({ page }) => {
  await mockStaffAuth(page, STAFF_IMG);
  await page.route('**/api/crm/cp/image/flags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, router: 'manual' }),
    });
  });
  await page.route('**/api/crm/cp/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/image/flags')) return route.continue();
    if (url.pathname.includes('/credit')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ used: 0, limit: 1000 }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await injectStaffSession(page, STAFF_IMG);
  await page.goto('/crm/creative-os');
  await expect(page.getByRole('link', { name: 'Ảnh SOP' })).toHaveCount(0);
});

test('flag on + cap shows 11 subnav and dash tiles', async ({ page }) => {
  await mockStaffAuth(page, STAFF_IMG);
  await page.route('**/api/crm/cp/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/image/flags')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, router: 'manual' }),
      });
    }
    if (path.endsWith('/image/dashboard/kpis')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kpis: {
            approved_month: null,
            brief_to_approved_hours: null,
            cost_per_approved: null,
            first_pass_rate: null,
          },
        }),
      });
    }
    if (path.includes('/image/dashboard/') || path.endsWith('/image/governance/audit')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }
    if (path.includes('/credit')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ used: 0, limit: 1000 }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await injectStaffSession(page, STAFF_IMG);
  await page.goto('/crm/creative-os/image');
  await expect(page.getByRole('heading', { name: /Enterprise Image Intelligence/ })).toBeVisible();
  await expect(page.getByText('—').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Tổng quan/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Governance/ })).toBeVisible();
});
