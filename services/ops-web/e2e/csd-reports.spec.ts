import { test, expect } from '@playwright/test';

const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo123';

const WEEKLY_SECTIONS = [
  'cover',
  'executive_summary',
  'ticket_sla',
  'work_completed',
  'risks',
  'next_week',
];

const MONTHLY_SECTIONS = [
  'cover',
  'executive_summary',
  'kpi',
  'channels',
  'work_completed',
  'risks',
  'next_month',
  'appendix',
];

function emptySections(keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, { body: '' }]));
}

const MONTHLY_DRAFT = {
  id: 'monthly-1',
  template_code: 'monthly_marketing',
  template_name_vi: 'Báo cáo marketing tháng',
  title: 'Báo cáo marketing tháng 2026-08-01 — 2026-08-31',
  client_account_id: 'client-a',
  client_account_name: 'Demo Client',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  status: 'draft',
  current_version: 'v1.0',
  version: 'v1.0',
  requires_approval: true,
  updated_at: '2026-09-01T10:00:00.000Z',
  sections_json: emptySections(MONTHLY_SECTIONS),
  versions: [],
  send_logs: [],
  template_sections: MONTHLY_SECTIONS,
};

const SENT_REPORT = {
  id: 'sent-1',
  template_code: 'monthly_marketing',
  template_name_vi: 'Báo cáo marketing tháng',
  title: 'Báo cáo marketing tháng đã gửi',
  client_account_id: 'client-a',
  client_account_name: 'Demo Client',
  period_start: '2026-08-01',
  period_end: '2026-08-31',
  status: 'sent',
  current_version: 'v1.0',
  version: 'v1.0',
  requires_approval: true,
  updated_at: '2026-09-02T10:00:00.000Z',
  sections_json: emptySections(MONTHLY_SECTIONS),
  versions: [],
  send_logs: [{ channel: 'email', result: 'sent' }],
  template_sections: MONTHLY_SECTIONS,
};

const STAFF_USER = {
  id: '3',
  email: STAFF_EMAIL,
  display_name: 'Demo AM',
  position_id: 3,
  position_code: 'am',
  caps: [
    { section: 'csd', action: 'view' },
    { section: 'csd', action: 'write' },
    { section: 'csd', action: 'manage' },
  ],
};

async function mockStaffAuth(page: import('@playwright/test').Page) {
  const session = {
    access_token: 'e2e-csd-report-token',
    refresh_token: 'e2e-csd-report-refresh',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_expires_in: 86400,
    user: STAFF_USER,
  };

  await page.route('**/api/v1/staff/auth/login**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });
  await page.route('**/api/v1/staff/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STAFF_USER),
    });
  });
  await page.route('**/api/v1/staff/auth/sso/config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'nest',
        issuer: null,
        client_id: '',
        nest_login_allowed: true,
        mfa_required_positions: [],
      }),
    });
  });
}

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function mockCsdReportApis(page: import('@playwright/test').Page) {
  const createdWeekly = {
    id: 'weekly-1',
    template_code: 'weekly_ops',
    template_name_vi: 'Báo cáo vận hành tuần',
    title: 'Báo cáo vận hành tuần',
    client_account_id: null as string | null,
    client_account_name: null as string | null,
    period_start: '2026-08-25',
    period_end: '2026-08-31',
    status: 'draft',
    current_version: 'v1.0',
    version: 'v1.0',
    requires_approval: false,
    updated_at: '2026-09-02T10:00:00.000Z',
    sections_json: emptySections(WEEKLY_SECTIONS),
    versions: [] as unknown[],
    send_logs: [] as unknown[],
    template_sections: WEEKLY_SECTIONS,
  };

  let items: Array<Record<string, unknown>> = [{ ...MONTHLY_DRAFT }, { ...SENT_REPORT }];
  const details: Record<string, Record<string, unknown>> = {
    'monthly-1': { ...MONTHLY_DRAFT },
    'sent-1': { ...SENT_REPORT },
  };
  const templateState: Record<string, Record<string, unknown>> = {};
  const commentsByReport: Record<
    string,
    Array<{
      id: string;
      report_id: string;
      version: string;
      section_key: string;
      body_text: string;
      created_at: string;
      created_by_staff_id: number;
      resolved_at: string | null;
    }>
  > = {};

  await page.route('**/api/crm/csd/conversations**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const filter = url.searchParams.get('filter');
    const clientAccountId = url.searchParams.get('client_account_id');
    const items = [
      { id: 'conv-client-a', kind: 'client', name_vi: 'Chat Demo Client', client_account_id: 'client-a' },
      { id: 'conv-client-b', kind: 'client', name_vi: 'Chat Khác', client_account_id: 'client-b' },
    ].filter((row) => filter !== 'clients' || row.kind === 'client')
      .filter((row) => !clientAccountId || row.client_account_id === clientAccountId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });

  await page.route('**/api/crm/csd/reports**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = new URL(url).pathname;

    if (method === 'POST' && /\/reports\/[^/]+\/submit-review$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const current = details[id] ?? {};
      const next = { ...current, status: 'in_review' };
      details[id] = next;
      items = items.map((row) => (row.id === id ? { ...row, status: 'in_review' } : row));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(next),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/approve$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const next = { ...(details[id] ?? {}), status: 'approved' };
      details[id] = next;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(next),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/request-changes$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const next = { ...(details[id] ?? {}), status: 'changes_requested' };
      details[id] = next;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(next),
      });
      return;
    }

    if (method === 'GET' && /\/reports\/templates$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'tpl-weekly',
              code: 'weekly_ops',
              name_vi: 'Báo cáo vận hành tuần',
              requires_approval: false,
              sections_json: WEEKLY_SECTIONS,
              active: true,
            },
            {
              id: 'tpl-monthly',
              code: 'monthly_marketing',
              name_vi: 'Báo cáo marketing tháng',
              requires_approval: true,
              sections_json: MONTHLY_SECTIONS,
              active: true,
            },
            {
              id: 'tpl-sla',
              code: 'monthly_sla',
              name_vi: 'Báo cáo ticket/SLA tháng',
              requires_approval: true,
              sections_json: ['cover', 'sla_kpis'],
              active: true,
            },
            {
              id: 'tpl-exec',
              code: 'executive',
              name_vi: 'Báo cáo điều hành',
              requires_approval: true,
              sections_json: ['cover', 'executive_summary'],
              active: true,
            },
          ].map((row) => ({ ...row, ...(templateState[row.id] ?? {}) })),
        }),
      });
      return;
    }

    if (method === 'PATCH' && /\/reports\/templates\/[^/]+$/.test(path)) {
      const id = path.split('/').pop() ?? '';
      const body = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
      templateState[id] = { ...(templateState[id] ?? {}), ...body };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, ...templateState[id], active: templateState[id]?.active !== false }),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/templates\/[^/]+\/archive$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      templateState[id] = { ...(templateState[id] ?? {}), active: false };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, active: false, ...templateState[id] }),
      });
      return;
    }

    if (method === 'GET' && /\/reports\/[^/]+\/comments$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const sectionKey = new URL(url).searchParams.get('section_key');
      const items = (commentsByReport[id] ?? []).filter(
        (c) => sectionKey == null || c.section_key === sectionKey,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/comments$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const body = (route.request().postDataJSON() as { section_key?: string; body_text?: string }) ?? {};
      const row = {
        id: `c-${Date.now()}`,
        report_id: id,
        version: 'v1.0',
        section_key: body.section_key ?? '',
        body_text: body.body_text ?? '',
        created_at: '2026-09-02T10:00:00.000Z',
        created_by_staff_id: 3,
        resolved_at: null,
      };
      commentsByReport[id] = [...(commentsByReport[id] ?? []), row];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(row),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/share-chat$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message_id: 'msg-share-1' }),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/send$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const current = details[id] ?? {};
      if (current.requires_approval && current.status === 'draft') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'report_not_approved', status: 'draft' }),
        });
        return;
      }
      const next = { ...current, status: 'sent' };
      details[id] = next;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'sent' }),
      });
      return;
    }

    if (method === 'POST' && /\/reports\/[^/]+\/transition$/.test(path)) {
      const id = path.split('/').at(-2) ?? '';
      const body = (route.request().postDataJSON() as { to?: string }) ?? {};
      if (body.to === 'sent') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'use_send_endpoint' }),
        });
        return;
      }
      const next = { ...(details[id] ?? {}), status: body.to };
      details[id] = next;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(next),
      });
      return;
    }

    if (method === 'POST' && /\/reports$/.test(path)) {
      const body = (route.request().postDataJSON() as {
        template_code?: string;
        client_account_id?: string;
        period_start?: string;
        period_end?: string;
        title?: string;
      }) ?? {};
      const weekly = { ...createdWeekly };
      if (body.period_start) weekly.period_start = body.period_start;
      if (body.period_end) weekly.period_end = body.period_end;
      if (body.title) weekly.title = body.title;
      if (body.client_account_id) weekly.client_account_id = body.client_account_id;
      weekly.template_code = body.template_code ?? 'weekly_ops';
      details[weekly.id] = weekly;
      items = [weekly, ...items];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(weekly),
      });
      return;
    }

    if (method === 'GET' && /\/reports\/[^/]+$/.test(path)) {
      const id = path.split('/').pop() ?? '';
      const detail = details[id];
      if (!detail) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'csd_report_not_found' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail),
      });
      return;
    }

    if (method === 'GET' && /\/reports$/.test(path)) {
      const status = new URL(url).searchParams.get('status');
      const filtered = status
        ? status === 'due'
          ? items.filter((row) =>
              ['draft', 'data_pending', 'in_review', 'changes_requested', 'approved', 'scheduled'].includes(
                String(row.status),
              ),
            )
          : items.filter((row) => row.status === status)
        : items;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: filtered }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe('CSD reports', () => {
  test('R-1: create weekly and block monthly send while draft', async ({ page }) => {
    await mockStaffAuth(page);
    await mockCsdReportApis(page);
    await loginAsStaff(page);
    await page.goto('/crm/csd/reports');
    await page.getByTestId('csd-report-new').click();
    await page.getByTestId('csd-report-template').selectOption('weekly_ops');
    await page.getByTestId('csd-report-create').click();
    await expect(page.getByTestId('csd-report-editor')).toBeVisible();
    await expect(page.getByTestId('csd-report-send')).toBeVisible();

    await page.goto('/crm/csd/reports/monthly-1');
    await expect(page.getByTestId('csd-report-send')).toHaveCount(0);
    await expect(page.getByTestId('csd-report-submit-review')).toBeVisible();
    await expect(page.getByTestId('csd-report-share-chat')).toHaveCount(0);
  });

  test('R-4: share sent report into client chat picker', async ({ page }) => {
    await mockStaffAuth(page);
    await mockCsdReportApis(page);
    await loginAsStaff(page);
    await page.goto('/crm/csd/reports/sent-1');
    await expect(page.getByTestId('csd-report-share-chat')).toBeVisible();
    await page.getByTestId('csd-report-share-chat').click();
    await expect(page.getByTestId('csd-report-share-chat-select')).toBeVisible();
    await expect(page.getByTestId('csd-report-share-chat-select')).toHaveValue('conv-client-a');
    await page.getByRole('button', { name: 'Gửi vào chat' }).click();
    await expect(page.getByText('Đã chia sẻ vào chat khách')).toBeVisible();
  });

  test('R-4: section comments and template archive stay listed', async ({ page }) => {
    await mockStaffAuth(page);
    await mockCsdReportApis(page);
    await loginAsStaff(page);

    await page.goto('/crm/csd/reports/monthly-1');
    await expect(page.getByTestId('csd-report-comments')).toBeVisible();
    await page.getByRole('button', { name: 'Rủi ro & chặn' }).click();
    await page.getByTestId('csd-report-comment-body').fill('Thiếu upsell trên mục rủi ro');
    await page.getByTestId('csd-report-comment-submit').click();
    await expect(page.getByText('Thiếu upsell trên mục rủi ro')).toBeVisible();

    await page.goto('/crm/csd/reports/templates');
    await expect(page.getByTestId('csd-report-templates')).toBeVisible();
    await expect(page.getByTestId('csd-report-template-weekly_ops')).toBeVisible();
    await expect(page.getByTestId('csd-report-template-monthly_marketing')).toBeVisible();
    await page.getByTestId('csd-report-template-archive-weekly_ops').click();
    await expect(page.getByTestId('csd-report-template-weekly_ops')).toBeVisible();
    await expect(page.getByTestId('csd-report-template-weekly_ops')).toContainText('Đã lưu trữ');
  });
});
