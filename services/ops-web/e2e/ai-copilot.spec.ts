import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * RNOS-39 — AI Copilot E2E (Pilot walkthrough bước 1–5, RNOS-06/03/04/08).
 *
 * Env (local / staging):
 *   OPS_E2E_URL              ops-web base (default http://127.0.0.1:3200)
 *   OPS_E2E_API_URL          Nest API (default http://127.0.0.1:3000)
 *   OPS_E2E_STAFF_EMAIL      pilot staff (default staff@demo.local)
 *   OPS_E2E_STAFF_PASSWORD   pilot password (default demo12345)
 *   OPS_E2E_AI_LEAD_ID       lead sqlite id with owner=staff or assign cap
 *   OPS_E2E_SKIP_SERVER      1 = do not start next start (reuse dev server)
 *   NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1  (set in playwright.config webServer)
 *
 * Prerequisites: Nest AI module up, PTT_STAFF_ALLOW_STUB=1 or PG staff_users,
 * lead readable by pilot user, copilot flag on at ops-web build time.
 */
const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo12345';
const API_URL = (process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const LEAD_ID_ENV = process.env.OPS_E2E_AI_LEAD_ID ?? '9000050';

const SUMMARIZE_PASTE_TEXT =
  'Khách hàng hỏi về gói dịch vụ quảng cáo Meta và muốn báo giá chi tiết qua Zalo trong tuần tới. ';

const OUTBOUND_BUTTON = /gửi zalo|gửi email|gửi sms|send (email|sms|message)|gửi tin nhắn/i;

async function apiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const health = await request.get(`${API_URL}/api/v1/ai/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

async function staffToken(request: APIRequestContext): Promise<string> {
  const login = await request.post(`${API_URL}/api/v1/staff/auth/login`, {
    data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
  });
  expect(login.ok(), `staff login: ${login.status()} ${await login.text()}`).toBeTruthy();
  const body = (await login.json()) as { access_token?: string };
  expect(body.access_token).toBeTruthy();
  return body.access_token!;
}

async function loginAsStaff(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(STAFF_EMAIL);
  await page.locator('#password').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function resolveLeadId(request: APIRequestContext): Promise<number> {
  const parsed = Number(LEAD_ID_ENV);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/v1/leads?limit=1&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `list leads: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { leads?: Array<{ id?: number }> };
  const id = body.leads?.[0]?.id;
  expect(id, 'No leads in API — set OPS_E2E_AI_LEAD_ID').toBeTruthy();
  return id!;
}

async function ensureLeadScored(request: APIRequestContext, leadId: number): Promise<void> {
  const token = await staffToken(request);
  const scoresUrl = `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`;

  async function hasLatestScore(): Promise<boolean> {
    const res = await request.get(scoresUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok()) return false;
    const body = (await res.json()) as { data?: { latest?: { score_value?: number } | null } };
    return body.data?.latest != null;
  }

  if (await hasLatestScore()) {
    return;
  }

  const res = await request.post(`${API_URL}/api/v1/ai/score/lead`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { lead_id: leadId },
  });

  if (!res.ok() && !(await hasLatestScore())) {
    expect(
      res.ok(),
      `score lead: ${res.status()} ${await res.text()} — ensure lead ${leadId} exists and staff has access`,
    ).toBeTruthy();
  }
}

function copilotPanel(page: Page) {
  return page.getByRole('complementary', { name: 'AI Copilot' });
}

async function assertNoOutboundSendButtons(page: Page) {
  const copilot = copilotPanel(page);
  await expect(copilot.getByRole('button', { name: OUTBOUND_BUTTON })).toHaveCount(0);
  await expect(page.getByRole('button', { name: OUTBOUND_BUTTON })).toHaveCount(0);
}

test.describe('RNOS-39 AI Copilot E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('API smoke — health, login, score, summarize', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable — start ptt-crm-api with PTT_AI_COPILOT_ENABLED=1');
    const health = await request.get(`${API_URL}/api/v1/ai/health`);
    const healthBody = (await health.json()) as { data?: { status?: string; copilot_enabled?: boolean } };
    expect(healthBody.data?.status).toBe('ok');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    const token = await staffToken(request);
    const scores = await request.get(
      `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(scores.ok()).toBeTruthy();
    const scoresBody = (await scores.json()) as { data?: { latest?: { score_value?: number } } };
    expect(scoresBody.data?.latest?.score_value).toBeGreaterThanOrEqual(0);

    const brief = await request.post(`${API_URL}/api/v1/ai/summarize`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        context: 'lead_brief',
        entity_type: 'lead',
        entity_id: String(leadId),
      },
    });
    expect(brief.ok(), `lead_brief: ${brief.status()}`).toBeTruthy();
  });

  test('pilot flow — lead detail score, brief, summarize (RNOS-06)', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);

    const copilot = copilotPanel(page);
    await expect(copilot).toBeVisible({ timeout: 20_000 });

    const scoreSection = copilot.getByRole('region', { name: 'Điểm lead' });
    await expect(scoreSection).toBeVisible();

    await expect
      .poll(
        async () => {
          const hasGauge = await scoreSection.locator('.ai-score-gauge__value').count();
          const hasEmpty = await scoreSection.getByText(/Chưa có điểm/i).count();
          const hasPending = await scoreSection.getByText(/Score đang cập nhật/i).count();
          return hasGauge > 0 || hasEmpty > 0 || hasPending > 0;
        },
        { timeout: 35_000, message: 'Score card should show gauge, empty, or pending state' },
      )
      .toBeTruthy();

    await copilot.getByRole('button', { name: 'Tóm tắt nhanh' }).click();
    await expect(copilot.locator('.ai-brief-result__summary')).toBeVisible({ timeout: 20_000 });

    const summarizeSection = copilot.getByRole('region', { name: 'Tóm tắt hoạt động' });
    await summarizeSection.getByRole('radio', { name: 'Dán nội dung' }).check();
    await summarizeSection.getByPlaceholder(/Dán ghi chú/i).fill(SUMMARIZE_PASTE_TEXT);
    await summarizeSection.getByRole('button', { name: 'Tóm tắt', exact: true }).click();
    await expect(summarizeSection.locator('.ai-summary-result')).toBeVisible({ timeout: 20_000 });

    await assertNoOutboundSendButtons(page);
    await expect(copilot.getByText(/Gợi ý AI — cần bạn duyệt/i)).toBeVisible();
  });

  test('mobile — AI tab shows copilot shell', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);

    await page.getByRole('tab', { name: 'AI' }).click();
    await expect(copilotPanel(page)).toBeVisible({ timeout: 15_000 });
    await assertNoOutboundSendButtons(page);
  });

  test('BR-AI-01 — no outbound send controls in copilot (static audit)', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);
    await expect(copilotPanel(page)).toBeVisible({ timeout: 20_000 });
    await assertNoOutboundSendButtons(page);
  });
});

test.describe('RNOS-39 follow-up draft (RNOS-07)', () => {
  test.skip(true, 'Follow-up draft + Duyệt ships in RNOS-07 — extend flow when API/UI land');
  test('draft generate → edit → approve without outbound send', async () => {
    // Placeholder for pilot step 6–7 after RNOS-07.
  });
});
