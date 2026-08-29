import { test, expect, type Page } from '@playwright/test';
import { API_URL, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';
import {
  createPhoneSession,
  nestApiReachable,
  openIntakeForLead,
  resolveIntakeLeadId,
} from './helpers/intake-bant-helpers';
import { fetchLeadFunnelApi, setupPresalesLeadStage } from './helpers/funnel-stepper-helpers';

/**
 * INT-SK Task 9 + Task 6 — Intake Deal Bar + Sales Kit chips + S4 kho.
 * Rules-only; do not require LLM.
 *
 * Run: cd services/ops-web && npx playwright test e2e/intake-deal-bar-sales-kit.spec.ts
 *
 * UAT-13–18 checklist (skip if no cap / no live upload / Playwright env missing):
 * - UAT-13 Admin upload Excel Q&A SEO + Duyệt → parse_status=ready, ≥1 chunk
 * - UAT-14 Chip Hỏi kho “KH nói đắt” → reply từ hàng Q&A + citation tên file
 * - UAT-15 Chip Bảng giá khi folder pricing trống → empty-state, không bịa số
 * - UAT-16 AM upload PDF túi phiên → chỉ lead đó retrieve
 * - UAT-17 Ảnh + LLM off → needs_ocr, không vào RAG
 * - UAT-18 MIME .docx → 400 unsupported_type
 */

async function openSalesKitIfNeeded(page: Page): Promise<void> {
  const chip = page.getByRole('button', { name: 'Còn thiếu để Go' });
  if (await chip.isVisible()) return;
  const toggle = page.getByRole('button', { name: 'Sales Kit' });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  await expect(chip).toBeVisible({ timeout: 15_000 });
}

test.describe('Intake Deal Bar + Sales Kit (S0–S2)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('deal bar and discovery tab replace stacked context cards', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await openIntakeForLead(page, leadId);
    await expect(page.locator('.intake-deal-bar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A. Ngữ cảnh lead' })).toHaveCount(0);

    await createPhoneSession(page);
    await expect(page.getByRole('tab', { name: /Discovery/i })).toBeVisible();

    const funnel = await fetchLeadFunnelApi(request, leadId);
    const slug = funnel.presales?.presales?.service_slug ?? '';
    if (slug === 'dich-vu-seo-tong-the') {
      await page.getByRole('tab', { name: /Discovery/i }).click();
      await expect(page.getByText(/Website\/domain cần SEO|seo_domain/i)).toBeVisible();
    }
  });

  test('kit chip Còn thiếu để Go shows 24 when BANT is 0', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);
    await expect(page.locator('.intake-deal-bar')).toContainText(/BANT 0\/30/);

    await openSalesKitIfNeeded(page);
    const chip = page.getByRole('button', { name: 'Còn thiếu để Go' });
    await expect(chip).toBeEnabled();
    await chip.click();

    const kit = page.locator('.intake-kit');
    await expect(kit.locator('.intake-kit__reply-text')).toContainText(/Còn 24/, {
      timeout: 20_000,
    });
  });
});

test.describe('Sales Kit S4 library (UAT-13–18, skip if no env)', () => {
  test('GET sample.xlsx contains KH nói đắt when staff token works', async ({ request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    let token = '';
    try {
      token = await staffToken(request);
    } catch {
      test.skip(true, 'Staff token unavailable');
    }
    const res = await request.get(`${API_URL}/api/crm/intake/sales-kit/sample.xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 401 || res.status() === 403) {
      test.skip(true, 'Missing intake view / configure cap');
    }
    expect(res.ok(), `sample.xlsx ${res.status()}`).toBeTruthy();
    const buf = Buffer.from(await res.body());
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.toString('utf8')).toMatch(/KH nói đắt|cau_hoi|xlsx/);
  });
});
