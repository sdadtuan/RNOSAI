import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const CONVERSATION = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  kind: 'client',
  name_vi: 'Demo Client Chat',
  client_account_id: 'client-a',
  last_message_at: '2026-09-01T10:00:00.000Z',
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
  await page.route('**/api/crm/csd/conversations**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [CONVERSATION] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/crm/csd/conversations/*/messages**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [MESSAGE] }),
    });
  });

  await page.route('**/api/crm/csd/messages/*/create-ticket**', async (route) => {
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
}

test.describe('CSD chat workspace', () => {
  test('3-column chat and create ticket modal', async ({ page }) => {
    await mockCsdChatApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/chat');
    await expect(page.getByRole('heading', { name: /Chat native/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('csd-chat-workspace')).toBeVisible();

    await page.getByRole('button', { name: 'Demo Client Chat' }).click();
    await expect(page.getByTestId('csd-chat-messages')).toContainText('Khách báo Ads không chạy');

    await page.getByRole('button', { name: /Tạo ticket/i }).click();
    await expect(page.getByTestId('csd-create-ticket-modal')).toBeVisible();
    await page.getByTestId('csd-create-ticket-modal').getByRole('button', { name: /Tạo ticket/i }).click();
  });
});
