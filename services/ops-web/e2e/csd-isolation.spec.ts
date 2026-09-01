import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const CSD_DASHBOARD = {
  need_action: 4,
  sla_risk: 2,
  reports_due: 1,
  inbox_waiting: 3,
  top_tickets: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'PTT-2026-000001',
      title: 'CSD ticket',
      description: '',
      ticket_type: 'request',
      status: 'assigned',
      priority: 'P2',
      sla_status: 'at_risk',
      assignee_staff_id: 3,
      assignee_staff_name: 'AM Demo',
      created_at: '2026-09-01T08:00:00.000Z',
      updated_at: '2026-09-01T09:00:00.000Z',
    },
  ],
};

const CRM_CS_TICKET = {
  id: 9001,
  customer_name: 'KH CSKH',
  title: 'Chỉ CSKH',
  ticket_type_label: 'Phản ánh',
  priority_label: 'Bình thường',
  status_label: 'Mới',
  assigned_staff_name: 'CS',
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
};

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\//);
}

test.describe('CSD isolation UAT', () => {
  test('AT-ISO-01 dashboard KPI and CS tickets stay separate', async ({ page }) => {
    await page.route('**/api/crm/csd/dashboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CSD_DASHBOARD),
      });
    });
    await page.route('**/api/crm/csd/tickets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: CSD_DASHBOARD.top_tickets, next_cursor: null }),
      });
    });
    await page.route('**/api/crm/tickets**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tickets: [CRM_CS_TICKET], total: 1 }),
      });
    });

    await loginAsStaff(page);

    await page.goto('/crm/csd');
    await expect(page.getByTestId('csd-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Cần xử lý')).toBeVisible();
    await expect(page.getByText('4')).toBeVisible();
    await expect(page.getByText('PTT-2026-000001')).toBeVisible();

    await page.goto('/crm/tickets');
    await expect(page.getByText('Chỉ CSKH')).toBeVisible();
    await expect(page.getByText('PTT-2026-000001')).toHaveCount(0);
  });

  test('AT-VIS-01 internal comment label visible on detail mock path', async ({ page }) => {
    const comments = [
      {
        id: 'c1',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        visibility: 'internal',
        body_text: 'Nội bộ only',
        author_staff_name: 'PM',
        created_at: '2026-09-01T10:00:00.000Z',
      },
    ];

    await page.route('**/api/crm/csd/tickets/11111111-1111-1111-1111-111111111111**', async (route) => {
      const url = route.request().url();
      if (url.includes('/comments')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: comments }) });
        return;
      }
      if (url.includes('/activities')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CSD_DASHBOARD.top_tickets[0]),
      });
    });
    await page.route('**/api/crm/staff**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ staff: [{ id: 3, name: 'AM Demo' }] }),
      });
    });

    await loginAsStaff(page);
    await page.goto('/crm/csd/tickets/11111111-1111-1111-1111-111111111111');
    await expect(page.getByTestId('csd-comment-internal')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nội bộ')).toBeVisible();
  });
});
