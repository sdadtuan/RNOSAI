import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const CONVERSATION = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  kind: 'client',
  status: 'active',
  name_vi: 'Demo Client Chat',
  client_account_id: 'client-a',
  owner_staff_id: 3,
  last_message_at: '2026-09-01T10:00:00.000Z',
  preview: 'Khách báo Ads không chạy',
  unread_count: 1,
  has_p1_or_complaint: false,
};

const GROUP_CONVERSATION = {
  id: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
  kind: 'group',
  status: 'active',
  name_vi: 'Nhóm AM',
  client_account_id: null,
  owner_staff_id: 3,
  last_message_at: '2026-09-01T09:00:00.000Z',
  preview: 'Standup 9h',
  unread_count: 0,
  has_p1_or_complaint: false,
};

const MESSAGE = {
  id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
  conversation_id: CONVERSATION.id,
  body_text: 'Khách báo Ads không chạy',
  visibility: 'client',
  author_staff_name: null,
  ticket_id: null,
  created_at: '2026-09-01T10:00:00.000Z',
};

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\//);
}

async function mockCsdChatApis(page: import('@playwright/test').Page) {
  let conversation = { ...CONVERSATION };
  let conversations: Array<Record<string, unknown>> = [{ ...CONVERSATION }, { ...GROUP_CONVERSATION }];
  let message = { ...MESSAGE };

  await page.route('**/api/crm/csd/conversations**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = new URL(url).pathname;
    if (url.includes('/members')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              conversation_id: CONVERSATION.id,
              member_type: 'staff',
              member_staff_id: 3,
              role: 'owner',
              created_at: '2026-09-01T10:00:00.000Z',
            },
          ],
        }),
      });
      return;
    }
    if (url.endsWith('/close') && method === 'POST') {
      conversation = { ...conversation, status: 'closed' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversation),
      });
      return;
    }
    if (url.endsWith('/reopen') && method === 'POST') {
      conversation = { ...conversation, status: 'reopened' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversation),
      });
      return;
    }
    if (method === 'POST' && /\/read$/.test(path)) {
      const id = path.split('/').at(-2);
      conversations = conversations.map((row) =>
        row.id === id ? { ...row, unread_count: 0 } : row,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ read: true }),
      });
      return;
    }
    if (method === 'GET' && url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [message] }),
      });
      return;
    }
    if (method === 'POST' && /\/conversations$/.test(path)) {
      const body = route.request().postDataJSON() as {
        kind?: string;
        name_vi?: string;
        client_account_id?: string;
        member_staff_ids?: number[];
        project_ref_kind?: string;
        project_ref_id?: string;
      };
      const peer = body.member_staff_ids?.[0];
      const created = {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        kind: body.kind ?? 'direct',
        status: 'active',
        name_vi: body.name_vi?.trim() || (peer ? `DM · #${peer}` : 'Hội thoại mới'),
        client_account_id: body.client_account_id ?? null,
        project_ref_kind: body.project_ref_kind ?? null,
        project_ref_id: body.project_ref_id ?? null,
        owner_staff_id: 3,
        last_message_at: null,
        preview: null,
        unread_count: 0,
        has_p1_or_complaint: false,
      };
      conversations = [created, ...conversations];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }
    if (method === 'GET') {
      const filter = new URL(url).searchParams.get('filter') || 'all';
      const items = conversations.filter((row) => {
        const kind = String(row.kind);
        if (filter === 'internal') return kind === 'direct' || kind === 'group';
        if (filter === 'clients') return kind === 'client';
        if (filter === 'projects') return kind === 'project';
        if (filter === 'unread') return Number(row.unread_count ?? 0) > 0;
        return true;
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/crm/csd/messages/*/create-ticket**', async (route) => {
    message = {
      ...message,
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_code: 'PTT-2026-000099',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        code: 'PTT-2026-000099',
        title: 'Khách báo Ads không chạy',
        status: 'new',
        priority: 'P3',
        sla_status: 'on_track',
      }),
    });
  });

  await page.route('**/api/crm/csd/ai/conversations/*/summarize**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: 'Khách báo Ads không chạy trong 24h.',
        decisions: [],
        actions: ['Xác nhận lại yêu cầu với khách trước khi cam kết.'],
        risks: [],
      }),
    });
  });
}

test.describe('CSD chat workspace', () => {
  test('3-column chat P1.5: banner, ticket same tab, AI summary, close', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await expect(page.getByRole('heading', { name: /Chat native/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible();

    await page.getByRole('button', { name: /Demo Client Chat/ }).click();
    await expect(page.getByTestId('csd-chat-client-banner')).toHaveText(/Bạn đang gửi cho khách hàng/);
    await expect(page.getByTestId('csd-chat-messages')).toContainText('Khách báo Ads không chạy');

    await page.getByRole('button', { name: /Tạo ticket/i }).click();
    await expect(page.getByTestId('csd-create-ticket-modal')).toBeVisible();
    await page.getByTestId('csd-create-ticket-modal').getByRole('button', { name: /Tạo ticket/i }).click();
    await expect(page.getByTestId('csd-chat-ticket-pill')).toHaveAttribute(
      'href',
      '/crm/csd/tickets/11111111-1111-1111-1111-111111111111',
    );

    await page.getByTestId('csd-chat-ai-summary').click();
    await expect(page.getByTestId('csd-chat-ai-output')).toContainText('Khách báo Ads không chạy');

    await page.getByRole('button', { name: /Đóng hội thoại/i }).click();
    await expect(page.getByRole('button', { name: /^Gửi$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Mở lại/i })).toBeVisible();
  });

  test('C-1: new modal creates DM and Nội bộ chip hides client chats', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-list')).toContainText('Demo Client Chat');
    await expect(page.getByTestId('csd-chat-list')).toContainText('Nhóm AM');

    await page.getByRole('button', { name: /^Mới$/ }).click();
    await expect(page.getByTestId('csd-chat-new-modal')).toBeVisible();
    await page.getByTestId('csd-chat-new-kind-direct').click();
    await page.getByTestId('csd-chat-new-peer').fill('8');
    await page.getByTestId('csd-chat-new-submit').click();
    await expect(page.getByTestId('csd-chat-list')).toContainText('DM · #8');

    await page.getByTestId('csd-chat-filter-internal').click();
    await expect(page.getByTestId('csd-chat-list')).not.toContainText('Demo Client Chat');
    await expect(page.getByTestId('csd-chat-list')).toContainText('Nhóm AM');
    await expect(page.getByTestId('csd-chat-list')).toContainText('DM · #8');
    await expect(page.getByTestId('csd-chat-client-banner')).toHaveCount(0);
  });
});
