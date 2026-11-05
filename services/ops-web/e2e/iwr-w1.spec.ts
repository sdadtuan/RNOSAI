import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const DAILY_DRAFT = {
  id: 'r-daily',
  template_code: 'daily_work',
  template_name_vi: 'Báo cáo ngày',
  title: 'Báo cáo ngày 2026-09-03',
  author_staff_id: 3,
  author_name: 'Demo NV',
  reviewer_staff_id: 2,
  period_start: '2026-09-03',
  period_end: '2026-09-03',
  due_at: '2026-09-03T17:00:00.000+07:00',
  status: 'draft',
  version: 'v1.0',
  rag: null,
  is_late: false,
  late_reason: null,
  first_viewed_at: null,
  submitted_at: null,
  acknowledged_at: null,
  sections_json: {
    general: { body: '', items: [] },
    done: { body: 'Xong việc A', items: [] },
    wip: { body: '', items: [] },
    next: { body: '', items: [] },
    blocked: { body: '', items: [] },
    approvals: { body: '', items: [] },
    notes: { body: '', items: [] },
  },
  recipients: [],
  comments: [],
  versions: [],
};

const STAFF_USER = {
  id: '3',
  email: STAFF_EMAIL,
  display_name: 'Demo NV',
  position_id: 3,
  caps: [
    { section: 'iwr', action: 'view' },
    { section: 'iwr', action: 'write' },
    { section: 'iwr', action: 'review' },
  ],
};

test.describe('IWR W1', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staff/me', async (route) => {
      await route.fulfill({ json: STAFF_USER });
    });
    await page.route('**/api/staff/auth/login', async (route) => {
      await route.fulfill({
        json: { access_token: 'test-token', refresh_token: 'refresh', user: STAFF_USER },
      });
    });
    await page.route('**/api/crm/iwr/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes('/reports') && method === 'GET' && !url.match(/\/reports\/[^/]+$/)) {
        return route.fulfill({ json: { items: [] } });
      }
      if (url.endsWith('/reports') && method === 'POST') {
        return route.fulfill({ json: DAILY_DRAFT });
      }
      if (url.match(/\/reports\/r-daily$/) && method === 'GET') {
        return route.fulfill({ json: DAILY_DRAFT });
      }
      if (url.includes('/reports/r-daily/submit') && method === 'POST') {
        return route.fulfill({ json: { ...DAILY_DRAFT, status: 'submitted', submitted_at: new Date().toISOString() } });
      }
      if (url.includes('/inbox') && method === 'GET') {
        return route.fulfill({
          json: {
            items: [{ ...DAILY_DRAFT, status: 'submitted', title: 'Báo cáo ngày 2026-09-03' }],
          },
        });
      }
      if (url.includes('/comments')) {
        return route.fulfill({ json: { items: [] } });
      }
      return route.fulfill({ json: { items: [] } });
    });
  });

  test('staff opens today and submits without client-send control', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/password|mật khẩu/i).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập|login/i }).click();

    await page.goto('/crm/internal-reports');
    await expect(page.getByText('Nội bộ — không gửi khách')).toBeVisible();
    await page.getByRole('button', { name: 'Mở hôm nay' }).click();
    await expect(page).toHaveURL(/\/crm\/internal-reports\/r-daily/);
    await expect(page.getByText('Gửi khách')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nộp' }).click();
    await expect(page.getByText('Đã gửi')).toBeVisible();
  });

  test('manager inbox shows submitted report', async ({ page }) => {
    await page.goto('/crm/internal-reports/inbox');
    await page.getByRole('tab', { name: 'Cần xử lý' }).click();
    await expect(page.getByText('Báo cáo ngày 2026-09-03')).toBeVisible();
  });
});
