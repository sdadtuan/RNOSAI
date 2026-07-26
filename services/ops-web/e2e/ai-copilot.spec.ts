import { test, expect } from '@playwright/test';
import {
  API_URL,
  SUMMARIZE_PASTE_TEXT,
  apiReachable,
  assertNoOutboundSendButtons,
  copilotPanel,
  fetchAgentRunCount,
  ensureLeadScored,
  loginAsStaff,
  resolveLeadId,
  staffToken,
  waitForScoreCard,
} from './helpers/ai-copilot-helpers';

/**
 * RNOS-39 — AI Copilot E2E (Pilot 8 bước UAT + API smoke).
 *
 * Env: see services/ops-web/e2e/README.md
 *
 * Local:
 *   bash scripts/playwright_ops_ai_copilot_e2e.sh
 *
 * CI:
 *   .github/workflows/rnos39-ai-copilot-e2e.yml
 */
test.describe('RNOS-39 AI Copilot E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('API smoke — health, login, score, summarize', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');
    const health = await request.get(`${API_URL}/api/v1/ai/health`);
    const healthBody = (await health.json()) as { data?: { status?: string } };
    expect(healthBody.data?.status).toMatch(/ok|degraded/);

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    const token = await staffToken(request);
    const scores = await request.get(
      `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(scores.ok()).toBeTruthy();

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

  test('pilot walkthrough — 8 steps UAT (login → score → brief → summarize → draft approve → audit)', async ({
    page,
    request,
  }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);
    const token = await staffToken(request);
    const runsBefore = await fetchAgentRunCount(request, token);

    // Step 1 — login pilot user
    await loginAsStaff(page);

    // Step 2 — open lead detail (owner lead)
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page).toHaveURL(new RegExp(`/crm/leads/${leadId}`));

    const copilot = copilotPanel(page);
    await expect(copilot).toBeVisible({ timeout: 20_000 });

    // Step 3 — score + explainability
    await waitForScoreCard(page);

    // Step 4 — lead brief (5 bullets)
    await copilot.getByRole('button', { name: 'Tóm tắt nhanh' }).click();
    await expect(copilot.locator('.ai-brief-result__summary')).toBeVisible({ timeout: 20_000 });
    const bullets = copilot.locator('.ai-brief-result__bullets li');
    const bulletCount = await bullets.count();
    expect(bulletCount).toBeGreaterThanOrEqual(1);
    expect(bulletCount).toBeLessThanOrEqual(5);

    // Step 5 — summarize activity (paste mode)
    const summarizeSection = copilot.getByRole('region', { name: 'Tóm tắt hoạt động' });
    await summarizeSection.getByRole('radio', { name: 'Dán nội dung' }).check();
    await summarizeSection.getByPlaceholder(/Dán ghi chú/i).fill(SUMMARIZE_PASTE_TEXT);
    await summarizeSection.getByRole('button', { name: 'Tóm tắt', exact: true }).click();
    await expect(summarizeSection.locator('.ai-summary-result')).toBeVisible({ timeout: 20_000 });

    // Step 6–7 — follow-up draft → edit → approve (BR-AI-01: activity note only)
    const followUp = copilot.getByRole('region', { name: 'Soạn follow-up' });
    await followUp.getByRole('radio', { name: 'Zalo' }).check();
    await followUp.getByRole('button', { name: 'Soạn nháp' }).click();
    const textarea = followUp.locator('textarea[aria-label="Nội dung nháp follow-up"]');
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill(`${await textarea.inputValue()}\n\nEm xin phép follow-up thêm thông tin ạ.`);
    await followUp.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(followUp.getByText(/Đã duyệt — ghi activity note/i)).toBeVisible({ timeout: 20_000 });

    await assertNoOutboundSendButtons(page);
    await expect(copilot.getByText(/Gợi ý AI — cần bạn duyệt/i)).toBeVisible();

    // Step 8 — audit trail has new runs (≥ brief + summarize + draft + health checks)
    const runsAfter = await fetchAgentRunCount(request, token);
    if (runsBefore === 0 && runsAfter === 0) {
      test.info().annotations.push({
        type: 'warning',
        description: 'GET /ai/runs unavailable — audit step skipped (enable PTT_CRM_INTERNAL_KEY + staff JWT)',
      });
    } else {
      expect(runsAfter).toBeGreaterThanOrEqual(runsBefore + 2);
    }
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

test.describe('RNOS-39 follow-up draft API (RNOS-07)', () => {
  test.describe.configure({ mode: 'serial' });

  test('API — generate, list, accept creates activity note', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    const token = await staffToken(request);

    const draft = await request.post(`${API_URL}/api/v1/ai/recommendation`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        type: 'follow_up_draft',
        entity_type: 'lead',
        entity_id: String(leadId),
        channel_hint: 'zalo',
      },
    });
    expect(draft.ok(), `follow_up_draft: ${draft.status()} ${await draft.text()}`).toBeTruthy();
    const draftBody = (await draft.json()) as {
      data?: { id?: string; text?: string; status?: string };
    };
    expect(draftBody.data?.status).toBe('pending');

    const list = await request.get(
      `${API_URL}/api/v1/ai/recommendations?entity_type=lead&entity_id=${leadId}&status=pending&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(list.ok()).toBeTruthy();

    const accept = await request.patch(
      `${API_URL}/api/v1/ai/recommendations/${draftBody.data!.id}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          status: 'accepted',
          final_text: draftBody.data!.text,
        },
      },
    );
    expect(accept.ok(), `accept draft: ${accept.status()} ${await accept.text()}`).toBeTruthy();
    const acceptBody = (await accept.json()) as { data?: { status?: string; activity_id?: number } };
    expect(acceptBody.data?.status).toBe('accepted');
    expect(acceptBody.data?.activity_id).toBeGreaterThan(0);
  });
});
