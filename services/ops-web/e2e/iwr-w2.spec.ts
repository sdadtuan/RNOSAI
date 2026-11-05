import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const DAILY = {
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
    done: { body: '', items: [] },
    wip: { body: '', items: [] },
    next: { body: '', items: [] },
    blocked: { body: '', items: [] },
    approvals: { body: '', items: [] },
    notes: { body: '', items: [] },
  },
  recipients: [{ id: 'rc1', report_id: 'r-daily', staff_id: 2, kind: 'to', staff_name: 'QLTT' }],
  comments: [],
  versions: [],
  items: [],
  viewer_is_author: true,
};

const STAFF_USER = {
  id: '3',
  email: STAFF_EMAIL,
  display_name: 'Demo NV',
  position_id: 3,
  caps: [
    { section: 'iwr', action: 'view' },
    { section: 'iwr', action: 'write' },
    { section: 'iwr', action: 'export' },
  ],
};

test.describe('IWR W2', () => {
  test.beforeEach(async ({ page }) => {
    const items: { id: string; title: string; ref_kind: string; ref_id: string | null }[] = [];
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
      if (url.match(/\/reports\/r-daily$/) && method === 'GET') {
        return route.fulfill({
          json: { ...DAILY, items, first_viewed_at: '2026-09-03T10:00:00.000+07:00' },
        });
      }
      if (url.includes('/reports/r-daily/suggest')) {
        return route.fulfill({
          json: {
            items: [
              { kind: 'csd_ticket', id: 't1', label: 'SD-1 Xong banner', reason: 'closed_today' },
            ],
          },
        });
      }
      if (url.includes('/reports/r-daily/items') && method === 'POST') {
        const row = {
          id: 'it1',
          report_id: 'r-daily',
          section_key: 'done',
          title: 'SD-1 Xong banner',
          body: '',
          ref_kind: 'csd_ticket',
          ref_id: 't1',
          evidence_url: null,
          sort_order: 0,
        };
        items.push(row);
        return route.fulfill({ json: row });
      }
      if (url.includes('/reports/r-daily/items')) {
        return route.fulfill({ json: { items } });
      }
      if (url.includes('/reports/r-daily/viewed')) {
        return route.fulfill({ json: { first_viewed_at: '2026-09-03T10:00:00.000+07:00' } });
      }
      if (url.includes('/comments')) {
        return route.fulfill({ json: { items: [] } });
      }
      return route.fulfill({ json: { items: [] } });
    });
  });

  test('staff attaches suggested ticket and sees viewed', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/password|mật khẩu/i).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập|login/i }).click();

    await page.goto('/crm/internal-reports/r-daily');
    await expect(page.getByText('Gợi ý hôm nay')).toBeVisible();
    await page.getByRole('button', { name: '+ SD-1 Xong banner' }).click();
    await expect(page.getByText('csd_ticket')).toBeVisible();
    await expect(page.getByText('Đã xem')).toBeVisible();
    await expect(page.getByText('Gửi khách')).toHaveCount(0);
  });
});
