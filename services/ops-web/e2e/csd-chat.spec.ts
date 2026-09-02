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
  author_staff_id: 3,
  author_staff_name: null,
  ticket_id: null,
  created_at: new Date().toISOString(),
  is_deleted: false,
  attachments: [
    {
      id: 'img-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      file_name: 'shot.png',
      mime_type: 'image/png',
      byte_size: 12,
      visibility: 'client',
    },
  ] as Array<{ id: string; file_name: string; mime_type: string; byte_size: number; visibility: string }>,
};

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\//);
}

async function unlockCsdChat(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('csd-chat-login')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('csd-chat-login-username').fill('demo.am');
  await page.getByTestId('csd-chat-login-password').fill('ChatPass1');
  await page.getByTestId('csd-chat-login-submit').click();
  await expect(page.getByTestId('csd-chat-login')).toHaveCount(0);
}

async function mockCsdChatApis(page: import('@playwright/test').Page) {
  let conversation = { ...CONVERSATION };
  let conversations: Array<Record<string, unknown>> = [{ ...CONVERSATION }, { ...GROUP_CONVERSATION }];
  let message = { ...MESSAGE };
  let ticketCreateCount = 0;

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
    if (method === 'GET' && url.includes('/related-tickets')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              code: 'PTT-2026-000099',
              title: 'Khách báo Ads không chạy',
              status: 'new',
              priority: 'P3',
            },
          ],
        }),
      });
      return;
    }
    if (method === 'POST' && url.includes('/archive')) {
      conversation = { ...conversation, status: 'archived' };
      conversations = conversations.map((row) =>
        row.id === conversation.id ? { ...row, status: 'archived' } : row,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversation),
      });
      return;
    }
    if (method === 'POST' && url.includes('/messages')) {
      const body = route.request().postDataJSON() as { body_text?: string };
      message = {
        ...message,
        body_text: body.body_text ?? message.body_text,
        priority_suggestion: String(body.body_text ?? '').includes('ngưng chạy') ? 'P1' : null,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(message),
      });
      return;
    }
    if (method === 'POST' && url.includes('/files')) {
      const uploaded = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        file_name: 'brief.pdf',
        mime_type: 'application/pdf',
        byte_size: 12,
        visibility: conversation.kind === 'client' ? 'client' : 'internal',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploaded),
      });
      return;
    }
    if (method === 'GET' && url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [message], me_staff_id: 3 }),
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
      const parsed = new URL(url);
      const filter = parsed.searchParams.get('filter') || 'all';
      const q = (parsed.searchParams.get('q') || '').trim().toLowerCase();
      const items = conversations.filter((row) => {
        const kind = String(row.kind);
        if (filter === 'internal') return kind === 'direct' || kind === 'group';
        if (filter === 'clients') return kind === 'client';
        if (filter === 'projects') return kind === 'project';
        if (filter === 'unread') return Number(row.unread_count ?? 0) > 0;
        if (q.length >= 2) {
          const hay = `${row.name_vi ?? ''} ${row.preview ?? ''}`.toLowerCase();
          return hay.includes(q);
        }
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

  await page.route('**/api/crm/csd/chat/people**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ staff_id: 8, display_name_vi: 'Bạn B' }] }),
    });
  });

  await page.route('**/api/crm/csd/chat/friends/requests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ incoming: [], outgoing: [] }),
    });
  });

  await page.route('**/api/crm/csd/chat/friends**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ staff_id: 8, display_name_vi: 'Bạn B' }] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/crm/csd/chat/login**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, staff_id: 3, username: 'demo.am' }),
    });
  });

  await page.route('**/api/crm/csd/chat/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        staff_id: 3,
        enabled: true,
        display_name_vi: 'Demo AM',
        username: 'demo.am',
        has_password: true,
      }),
    });
  });

  await page.route('**/api/crm/csd/chat/unread-count**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1 }),
    });
  });

  await page.route('**/api/crm/csd/messages/**', async (route) => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    if (method === 'POST' && path.endsWith('/create-ticket')) {
      ticketCreateCount += 1;
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
          already_exists: ticketCreateCount > 1,
        }),
      });
      return;
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as { body_text?: string };
      message = { ...message, body_text: body.body_text ?? message.body_text, edited_at: new Date().toISOString() };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(message),
      });
      return;
    }
    if (method === 'DELETE') {
      message = { ...message, is_deleted: true, body_text: '' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(message),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/crm/csd/tickets**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            code: 'PTT-2026-000099',
            title: 'Khách báo Ads không chạy',
            status: 'new',
            priority: 'P3',
          },
        ],
        next_cursor: null,
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
        actions: ['Gọi khách xác nhận campaign'],
        risks: [],
        ai_interaction_id: 'aiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
      }),
    });
  });

  await page.route('**/api/crm/csd/ai/interactions/*/actions/*/create-ticket**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        code: 'PTT-2026-000050',
        title: 'Gọi khách xác nhận campaign',
        status: 'new',
        priority: 'P3',
      }),
    });
  });
}

test.describe('CSD chat workspace', () => {
  test('3-column chat P1.5: banner, ticket same tab, AI summary, close', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await unlockCsdChat(page);
    await expect(page.getByRole('heading', { name: /Chat native/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible();

    await page.getByRole('button', { name: /Demo Client Chat/ }).click();
    await expect(page.getByTestId('csd-chat-client-banner')).toHaveText(/Bạn đang gửi cho khách hàng/);
    await expect(page.getByTestId('csd-chat-messages')).toContainText('Khách báo Ads không chạy');

    await page.getByTestId('csd-chat-msg-menu').click();
    await page.getByRole('button', { name: /^Tạo ticket$/ }).click();
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

  test('D-4: launcher hidden when chat account disabled', async ({ page }) => {
    await mockCsdChatApis(page);
    await page.route('**/api/crm/csd/chat/me**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ staff_id: 3, enabled: false, display_name_vi: null }),
      }),
    );
    await loginAsStaff(page);
    await page.goto('/crm/csd');
    await expect(page.getByTestId('csd-chat-launcher')).toHaveCount(0);
    await page.goto('/crm/csd/chat');
    await expect(page.getByTestId('csd-chat-disabled')).toBeVisible();
    await expect(page.getByTestId('csd-chat-workspace')).toHaveCount(0);
  });

  test('C-5: dock bubbles, send, hide on chat page', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);
    await page.goto('/crm/csd');
    await expect(page.getByTestId('csd-chat-launcher')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('csd-chat-launcher').click();
    await unlockCsdChat(page);
    await page.getByTestId('csd-chat-dock').getByTestId('csd-chat-list').locator('button').first().click();
    await expect(page.getByTestId('csd-chat-dock').locator('.csd-chat-message.is-mine, .csd-chat-message.is-theirs')).toHaveCount(1);
    await expect(page.getByTestId('csd-chat-dock').getByTestId('csd-chat-date-chip')).toBeVisible();
    await expect(page.getByTestId('csd-chat-dock').getByTestId('csd-chat-image')).toBeVisible();
    await expect(page.getByTestId('csd-chat-dock').getByTestId('csd-chat-msg-menu')).toBeVisible();
    await page.getByTestId('csd-chat-dock').getByTestId('csd-chat-thread-info').click();
    await expect(page.getByTestId('csd-chat-info-sheet')).toBeVisible();
    await page.getByTestId('csd-chat-info-sheet').getByRole('button', { name: /Đóng/ }).click();
    await page.getByTestId('csd-chat-dock').getByTestId('csd-chat-draft').fill('Xin chào');
    await page.getByTestId('csd-chat-dock').getByRole('button', { name: 'Gửi' }).click();
    await page.goto('/crm/csd/chat');
    await expect(page.getByTestId('csd-chat-launcher')).toHaveCount(0);
    await expect(page.locator('.csd-chat-message.is-mine, .csd-chat-message.is-theirs')).toHaveCount(1);
  });

  test('D-1: message bubbles use mine/theirs', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);
    await page.goto('/crm/csd/chat');
    await unlockCsdChat(page);
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('csd-chat-list').locator('button').first().click();
    await expect(page.locator('.csd-chat-message.is-theirs, .csd-chat-message.is-mine')).toHaveCount(1);
  });

  test('C-1: new modal creates DM and Nội bộ chip hides client chats', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await unlockCsdChat(page);
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-list')).toContainText('Demo Client Chat');
    await expect(page.getByTestId('csd-chat-list')).toContainText('Nhóm AM');

    await page.getByRole('button', { name: /^Mới$/ }).click();
    await expect(page.getByTestId('csd-chat-new-modal')).toBeVisible();
    await page.getByTestId('csd-chat-new-kind-direct').click();
    await page.getByTestId('csd-chat-new-peer').selectOption('8');
    await page.getByTestId('csd-chat-new-submit').click();
    await expect(page.getByTestId('csd-chat-list')).toContainText('DM · #8');

    await page.getByTestId('csd-chat-filter-internal').click();
    await expect(page.getByTestId('csd-chat-list')).not.toContainText('Demo Client Chat');
    await expect(page.getByTestId('csd-chat-list')).toContainText('Nhóm AM');
    await expect(page.getByTestId('csd-chat-list')).toContainText('DM · #8');
    await expect(page.getByTestId('csd-chat-client-banner')).toHaveCount(0);
  });

  test('C-2: search list and show related tickets plus # suggest', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await unlockCsdChat(page);
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('csd-chat-search').fill('Ads');
    await expect(page.getByTestId('csd-chat-list')).toContainText('Demo Client Chat');
    await expect(page.getByTestId('csd-chat-list')).not.toContainText('Nhóm AM');

    await page.getByRole('button', { name: /Demo Client Chat/ }).click();
    await expect(page.getByTestId('csd-chat-related-tickets')).toContainText('PTT-2026-000099');
    await page.getByTestId('csd-chat-draft').fill('#PTT');
    await expect(page.getByTestId('csd-chat-ticket-suggest')).toContainText('PTT-2026-000099');
  });

  test('C-3: attach file then edit and soft-delete own message', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await unlockCsdChat(page);
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Demo Client Chat/ }).click();

    await page.getByTestId('csd-chat-attach').setInputFiles({
      name: 'brief.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(page.getByTestId('csd-chat-pending-files')).toContainText('brief.pdf');

    await page.getByTestId('csd-chat-msg-menu').click();
    await page.getByTestId('csd-chat-edit').click();
    await page.getByTestId('csd-chat-edit-draft').fill('Khách báo Ads đã sửa');
    await page.getByRole('button', { name: /^Lưu$/ }).click();
    await expect(page.getByTestId('csd-chat-messages')).toContainText('Khách báo Ads đã sửa');

    await page.getByTestId('csd-chat-msg-menu').click();
    await page.getByTestId('csd-chat-delete').click();
    await expect(page.getByTestId('csd-chat-deleted')).toHaveText(/Đã xóa/);
  });

  test('C-4: priority hint, duplicate ticket dialog, archive, AI action ticket, deep link', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto(`/crm/csd/chat?c=${CONVERSATION.id}`);
    await unlockCsdChat(page);
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-messages')).toContainText('Khách báo Ads không chạy');

    await page.getByTestId('csd-chat-draft').fill('Ads ngưng chạy');
    await page.getByRole('button', { name: /^Gửi$/ }).click();
    await expect(page.getByTestId('csd-chat-priority-hint')).toContainText('P1');

    await page.getByRole('button', { name: /Tạo ticket/i }).first().click();
    await page.getByTestId('csd-create-ticket-modal').getByRole('button', { name: /Tạo ticket/i }).click();
    await page.getByTestId('csd-chat-draft').fill('Ads ngưng chạy lần 2');
    await page.getByRole('button', { name: /^Gửi$/ }).click();
    await page.getByRole('button', { name: /Tạo ticket/i }).first().click();
    await page.getByTestId('csd-create-ticket-modal').getByRole('button', { name: /Tạo ticket/i }).click();
    await expect(page.getByTestId('csd-duplicate-ticket-modal')).toContainText('PTT-2026-000099');

    await page.getByTestId('csd-chat-archive').click();
    await expect(page.getByRole('button', { name: /^Gửi$/ })).toHaveCount(0);

    await page.getByTestId('csd-chat-ai-summary').click();
    await expect(page.getByTestId('csd-chat-ai-actions')).toBeVisible();
    await page.getByTestId('csd-chat-ai-actions').getByRole('button', { name: /Tạo ticket/i }).click();
  });

  test('C-6: friend request, accept, not_friends dialog', async ({ page }) => {
    let friends: Array<{ staff_id: number; display_name_vi: string }> = [];
    let incoming: Array<Record<string, unknown>> = [];
    await mockCsdChatApis(page);
    await page.route('**/api/crm/csd/chat/people**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ staff_id: 8, display_name_vi: 'Bạn B' }] }),
      }),
    );
    await page.route('**/api/crm/csd/chat/friends/requests**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ incoming, outgoing: [] }),
      }),
    );
    await page.route('**/api/crm/csd/chat/friends**', async (route) => {
      if (route.request().method() === 'POST' && !route.request().url().includes('/accept')) {
        incoming = [{ id: 'f1', requester_staff_id: 3, addressee_staff_id: 8, status: 'pending' }];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(incoming[0]),
        });
        return;
      }
      if (route.request().url().includes('/accept')) {
        friends = [{ staff_id: 8, display_name_vi: 'Bạn B' }];
        incoming = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'f1', status: 'accepted' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: friends }),
      });
    });
    await loginAsStaff(page);
    await page.goto('/crm/csd');
    await page.getByTestId('csd-chat-launcher').click();
    await unlockCsdChat(page);
    await page.getByTestId('csd-chat-tab-contacts').click();
    await page.getByTestId('csd-chat-people-q').fill('Bạn');
    await page.getByTestId('csd-chat-friend-request').click();
    await page.getByTestId('csd-chat-tab-requests').click();
    await expect(page.getByTestId('csd-chat-friend-incoming')).toBeVisible();
    await page.getByRole('button', { name: /Chấp nhận/ }).click();

    await page.route('**/api/crm/csd/conversations**', async (route) => {
      if (route.request().method() === 'POST' && /\/conversations$/.test(new URL(route.request().url()).pathname)) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'not_friends' }),
        });
        return;
      }
      await route.fallback();
    });
    await page.getByTestId('csd-chat-tab-messages').click();
    await page.getByRole('button', { name: /^Mới$/ }).click();
    await page.getByTestId('csd-chat-new-kind-direct').click();
    await page.getByTestId('csd-chat-new-peer').selectOption('8');
    await page.getByTestId('csd-chat-new-submit').click();
    await expect(page.getByTestId('csd-chat-not-friends')).toBeVisible();
  });
});
