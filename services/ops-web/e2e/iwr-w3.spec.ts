import { test, expect } from '@playwright/test';

const GDKD_USER = {
  id: '2',
  email: 'gdkd@demo.local',
  display_name: 'GDKD',
  position_id: 2,
  caps: [
    { section: 'iwr', action: 'view' },
    { section: 'iwr', action: 'write' },
    { section: 'iwr', action: 'bcc' },
    { section: 'iwr', action: 'export' },
  ],
};

const REPORT = {
  id: 'r-w3',
  template_code: 'daily_work',
  template_name_vi: 'Báo cáo ngày',
  title: 'BC W3',
  author_staff_id: 2,
  author_name: 'GDKD',
  reviewer_staff_id: 1,
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
  recipients: [{ id: 'rc1', report_id: 'r-w3', staff_id: 1, kind: 'to', staff_name: 'CEO' }],
  comments: [],
  versions: [],
  items: [
    {
      id: 'item-b1',
      report_id: 'r-w3',
      section_key: 'blocked',
      title: 'Critical vendor delay',
      body: 'critical path blocked',
      ref_kind: 'none',
      ref_id: null,
      evidence_url: null,
      sort_order: 0,
    },
  ],
  viewer_is_author: true,
};

test.describe('IWR W3', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staff/me', async (route) => {
      await route.fulfill({ json: GDKD_USER });
    });
    await page.route('**/api/staff/auth/login', async (route) => {
      await route.fulfill({
        json: { access_token: 'test-token', refresh_token: 'refresh', user: GDKD_USER },
      });
    });
    await page.route('**/api/crm/iwr/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes('/directory') && url.includes('purpose=bcc')) {
        return route.fulfill({
          json: { items: [{ id: 4, name: 'HR', email: 'h', department_id: 20, reports_to_id: 1, active: true }] },
        });
      }
      if (url.match(/\/reports\/r-w3$/) && method === 'GET') {
        return route.fulfill({ json: REPORT });
      }
      if (url.includes('/reports/r-w3/items')) {
        return route.fulfill({ json: { items: REPORT.items } });
      }
      if (url.includes('/reports/r-w3/comments')) {
        return route.fulfill({ json: { items: [] } });
      }
      if (url.includes('/reports/r-w3/viewed')) {
        return route.fulfill({ json: { first_viewed_at: '2026-09-03T10:00:00+07:00' } });
      }
      return route.fulfill({ json: {} });
    });
  });

  test('US-13 Bcc picker visible for GDKD cap', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('gdkd@demo.local');
    await page.getByLabel(/password/i).fill('demo123');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await page.goto('/crm/internal-reports/r-w3');
    await expect(page.getByTestId('iwr-bcc')).toBeVisible();
    await page.getByPlaceholder('Tìm Bcc...').fill('HR');
    await expect(page.getByRole('button', { name: 'HR' })).toBeVisible();
  });

  test('inbox shows Blocker tab', async ({ page }) => {
    await page.route('**/api/crm/iwr/inbox**', async (route) => {
      await route.fulfill({ json: { items: [] } });
    });
    await page.goto('/crm/internal-reports/inbox');
    await expect(page.getByRole('tab', { name: 'Blocker' })).toBeVisible();
  });
});
