import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const CSD_TICKET_A = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'PTT-2026-000001',
  title: 'Khách hỏi báo cáo tuần',
  description: 'Cần gửi số liệu Ads',
  ticket_type: 'request',
  status: 'assigned',
  priority: 'P2',
  sla_status: 'on_track',
  assignee_staff_id: 3,
  assignee_staff_name: 'AM Demo',
  sla_resolution_due_at: '2026-09-03T10:00:00.000Z',
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T09:00:00.000Z',
};

const CSD_TICKET_B = {
  ...CSD_TICKET_A,
  id: '22222222-2222-2222-2222-222222222222',
  code: 'PTT-2026-000002',
  title: 'Lỗi landing page',
  priority: 'P1',
  sla_status: 'at_risk',
};

const CRM_CS_TICKET = {
  id: 9001,
  customer_id: 1,
  customer_name: 'KH CSKH',
  title: 'Ticket CSKH riêng',
  ticket_type: 'phan_anh',
  ticket_type_label: 'Phản ánh',
  priority: 'binh_thuong',
  priority_label: 'Bình thường',
  status: 'moi',
  status_label: 'Mới',
  assigned_staff_name: 'CS Agent',
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

async function mockCsdTicketApis(page: import('@playwright/test').Page) {
  const comments: Array<Record<string, unknown>> = [];

  await page.route('**/api/crm/csd/tickets**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'GET' && /\/api\/crm\/csd\/tickets\/[^/?]+$/.test(url)) {
      const id = url.split('/').pop()?.split('?')[0];
      const ticket = id === CSD_TICKET_B.id ? CSD_TICKET_B : CSD_TICKET_A;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ticket),
      });
      return;
    }

    if (method === 'GET' && url.includes('/comments')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: comments }),
      });
      return;
    }

    if (method === 'GET' && url.includes('/activities')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
      return;
    }

    if (method === 'POST' && url.includes('/comments')) {
      const body = JSON.parse(route.request().postData() || '{}') as {
        visibility: string;
        body_text: string;
      };
      comments.push({
        id: `c-${comments.length + 1}`,
        ticket_id: CSD_TICKET_A.id,
        visibility: body.visibility,
        body_text: body.body_text,
        author_staff_name: 'AM Demo',
        created_at: new Date().toISOString(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(comments[comments.length - 1]),
      });
      return;
    }

    if (method === 'POST' && /\/api\/crm\/csd\/tickets\/?$/.test(url.replace(/\?.*$/, ''))) {
      const body = JSON.parse(route.request().postData() || '{}') as { title: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...CSD_TICKET_A, id: '33333333-3333-3333-3333-333333333333', title: body.title }),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [CSD_TICKET_A, CSD_TICKET_B], next_cursor: null }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/crm/csd/ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ body_text: 'Xin chào, chúng tôi đang xử lý yêu cầu của quý khách.' }),
    });
  });
}

async function mockCrmCsTickets(page: import('@playwright/test').Page) {
  await page.route('**/api/crm/tickets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tickets: [CRM_CS_TICKET], total: 1 }),
    });
  });
}

test.describe('CSD tickets UI', () => {
  test('lists CSD tickets, creates ticket, public vs internal comments', async ({ page }) => {
    await mockCsdTicketApis(page);
    await mockCrmCsTickets(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/tickets');
    await expect(page.getByRole('heading', { name: /Ticket Service Desk/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-ticket-row-PTT-2026-000001')).toBeVisible();
    await expect(page.getByTestId('csd-ticket-row-PTT-2026-000002')).toBeVisible();

    await page.getByTestId('csd-ticket-create').getByPlaceholder('Tiêu đề').fill('Ticket UAT mới');
    await page.getByTestId('csd-ticket-create').getByRole('button', { name: /Tạo ticket/i }).click();
    await expect(page).toHaveURL(/\/crm\/csd\/tickets\//);

    await expect(page.getByTestId('csd-ticket-detail')).toBeVisible();
    await page.getByRole('tab', { name: /Gửi cho khách hàng/i }).click();
    await page.getByTestId('csd-composer-body').fill('Phản hồi công khai cho khách');
    await page.getByTestId('csd-ticket-composer').getByRole('button', { name: /Gửi cho khách hàng/i }).click();
    await expect(page.getByTestId('csd-comment-public')).toBeVisible();

    await page.getByRole('tab', { name: /Ghi chú nội bộ/i }).click();
    await page.getByTestId('csd-composer-body').fill('Chỉ nội bộ AM/PM');
    await page.getByTestId('csd-ticket-composer').getByRole('button', { name: /Lưu ghi chú nội bộ/i }).click();
    await expect(page.getByTestId('csd-comment-internal')).toBeVisible();
    await expect(page.getByText('Nội bộ')).toBeVisible();
  });

  test('AT-ISO-01: /crm/tickets still shows CSKH fixture, not CSD codes', async ({ page }) => {
    await mockCsdTicketApis(page);
    await mockCrmCsTickets(page);
    await loginAsStaff(page);

    await page.goto('/crm/tickets');
    await expect(page.getByRole('heading', { name: /Ticket CS lite/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ticket CSKH riêng')).toBeVisible();
    await expect(page.getByText('PTT-2026-000001')).toHaveCount(0);
  });
});
