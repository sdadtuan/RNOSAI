import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  QT_KPI_KEYS,
  QT_PUBLIC_ACCEPT_CTA,
  QT_WIN_RATE_FORMULA,
  assertNoMockMoneyInQtComponents,
  convertQtVersionApi,
  createQuoteFromLeadApi,
  fetchPublicProposalApi,
  fetchQtCatalogApi,
  fetchQtOverviewApi,
  getQtProposalApi,
  listQtQuotesApi,
  mintQtShareApi,
  patchQtStatusApi,
  publicHtmlLeaks,
  putQtLinesApi,
  putQtPaymentsApi,
  qtCatalogItems,
  renderPortalPublicProposalHtml,
  resolveQtLeadId,
  staffToken,
} from './helpers/qt-w1-helpers';

test.describe('Quotation OS W1 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 1 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('staff without crm_quote cap gets 403 or redirected from /crm/proposals', async ({
    page,
  }) => {
    await loginAsStaff(page);
    await page.route('**/api/v1/staff/auth/me', async (route) => {
      const response = await route.fetch();
      const user = (await response.json()) as {
        caps?: Array<{ section: string; action: string }>;
      };
      await route.fulfill({
        response,
        json: {
          ...user,
          caps: (user.caps ?? []).filter(
            (cap) =>
              cap.section !== 'crm_quote' &&
              !cap.section.startsWith('crm_quote.') &&
              cap.section !== 'crm_board',
          ),
        },
      });
    });

    await page.goto('/crm/proposals');
    await expect(page).toHaveURL(/\/(?:403|login)(?:\?|$)/);
  });

  test('overview exposes 4 KPI tiles and accepted/(accepted+rejected)', async ({
    request,
    page,
  }) => {
    const token = await staffToken(request);
    const overview = await fetchQtOverviewApi(request, token);
    expect(overview.ok, `QT overview: ${overview.status}`).toBeTruthy();
    expect(Object.keys(overview.json.kpis ?? {}).sort()).toEqual([...QT_KPI_KEYS].sort());
    expect(overview.json.win_rate_formula).toBe(QT_WIN_RATE_FORMULA);

    await loginAsStaff(page);
    await page.goto('/crm/proposals');
    await expect(page.locator('.qt-tile')).toHaveCount(4);
    await expect(page.locator('main')).toContainText(QT_WIN_RATE_FORMULA);
  });

  test('create from lead uses QT-PTT-20 quote_code prefix', async ({ request }) => {
    const token = await staffToken(request);
    const leadId = await resolveQtLeadId(request, token);
    const created = await createQuoteFromLeadApi(request, token, {
      lead_id: leadId,
      title: `QT-W1-UAT-${Date.now()}`,
    });
    expect(
      created.ok,
      `QT create from lead ${leadId}: ${created.status} ${JSON.stringify(created.json)}`,
    ).toBeTruthy();
    expect(created.json.proposal?.quote_code).toMatch(/^QT-PTT-20/);
  });

  test('new quote form has no UUID text field for agency_client_id', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/proposals/new');
    await expect(page.locator('input[name=agency_client_id]')).toHaveCount(0);
  });

  test('draft catalog add is rejected', async ({ request, page }) => {
    const token = await staffToken(request);
    const leadId = await resolveQtLeadId(request, token);
    const created = await createQuoteFromLeadApi(request, token, {
      lead_id: leadId,
      title: `QT-W1-DRAFT-CAT-${Date.now()}`,
    });
    expect(created.ok, `create for draft catalog: ${created.status}`).toBeTruthy();
    const proposalId = created.json.proposal?.id;
    expect(proposalId).toEqual(expect.any(Number));

    const catalog = await fetchQtCatalogApi(request, token);
    const draft = qtCatalogItems(catalog.json).find((item) => {
      const status = String(item.status ?? '').toLowerCase();
      return status === 'draft' || item.can_add_to_client_quote === false;
    });
    const line = draft
      ? {
          dv_code: String(draft.dv_code ?? 'DV02'),
          package_tier: 'standard',
          client_visible: true,
          catalog_snapshot_json: { status: 'draft', ...(draft.catalog_snapshot_json as object) },
        }
      : {
          dv_code: 'DV02',
          package_tier: 'standard',
          client_visible: true,
          catalog_snapshot_json: { status: 'draft' },
        };
    const added = await putQtLinesApi(request, token, proposalId!, [line]);
    expect(added.ok).toBeFalsy();
    expect(added.status).toBe(400);
    expect(String((added.json as { error?: string }).error ?? '')).toMatch(
      /catalog_not_active|rate_missing/,
    );

    await loginAsStaff(page);
    await page.goto('/crm/proposals/catalog');
    const disabledAdd = page.locator('button[disabled]', { hasText: /Thêm vào báo giá/i });
    if ((await page.locator('button', { hasText: /Thêm vào báo giá/i }).count()) > 0) {
      await expect(disabledAdd.first()).toBeVisible();
    }
  });

  test('payment schedule requires 100% (pct_bps sum 10000)', async ({ request }) => {
    const token = await staffToken(request);
    const leadId = await resolveQtLeadId(request, token);
    const created = await createQuoteFromLeadApi(request, token, {
      lead_id: leadId,
      title: `QT-W1-PAY-${Date.now()}`,
    });
    expect(created.ok, `create for payments: ${created.status}`).toBeTruthy();
    const vid = created.json.proposal?.current_version_id;
    expect(vid).toBeTruthy();

    const invalid = await putQtPaymentsApi(request, token, vid!, [
      { pct_bps: 5000 },
      { pct_bps: 3000 },
      { pct_bps: 1000 },
    ]);
    expect(invalid.ok).toBeFalsy();
    expect(invalid.status).toBe(400);
    expect((invalid.json as { error?: string }).error).toBe('payment_pct_invalid');

    const valid = await putQtPaymentsApi(request, token, vid!, [
      { pct_bps: 5000, milestone: 'Đợt 1' },
      { pct_bps: 3000, milestone: 'Đợt 2' },
      { pct_bps: 2000, milestone: 'Đợt 3' },
    ]);
    expect(valid.ok, `valid payments: ${valid.status} ${JSON.stringify(valid.json)}`).toBeTruthy();
    const items = valid.json.items ?? [];
    expect(items.reduce((sum, item) => sum + Number(item.pct_bps), 0)).toBe(10000);
    expect(items).toHaveLength(3);
    const amounts = items.map((item) => BigInt(item.amount_vnd ?? 0));
    const allocated = amounts.slice(0, -1).reduce((sum, n) => sum + n, 0n);
    expect(amounts[amounts.length - 1]).toBe(amounts.reduce((sum, n) => sum + n, 0n) - allocated);
  });

  test('convert twice returns the same lifecycle ids', async ({ request }) => {
    const token = await staffToken(request);
    const listed = await listQtQuotesApi(request, token, 'scope=all&status=accepted&page_size=20');
    const items = listed.json.items ?? listed.json.proposals ?? [];
    let proposalId = 0;
    let versionId = '';

    for (const row of items) {
      const id = Number(row.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const detail = await getQtProposalApi(request, token, id);
      const vid = String(detail.json.current_version_id ?? '').trim();
      if (detail.json.status === 'accepted' && vid) {
        proposalId = id;
        versionId = vid;
        break;
      }
    }

    if (!proposalId) {
      const leadId = await resolveQtLeadId(request, token);
      const created = await createQuoteFromLeadApi(request, token, {
        lead_id: leadId,
        title: `QT-W1-CVT-${Date.now()}`,
      });
      expect(created.ok, `create for convert: ${created.status}`).toBeTruthy();
      proposalId = created.json.proposal!.id;
      versionId = created.json.proposal!.current_version_id;
      const catalog = await fetchQtCatalogApi(request, token);
      const active = qtCatalogItems(catalog.json).find(
        (item) =>
          item.can_add_to_client_quote === true && String(item.status ?? '').toLowerCase() === 'active',
      );
      if (active) {
        const added = await putQtLinesApi(request, token, proposalId, [
          {
            dv_code: String(active.dv_code),
            package_tier: 'standard',
            client_visible: true,
          },
        ]);
        expect(added.ok, `add active line: ${added.status} ${JSON.stringify(added.json)}`).toBeTruthy();
      }
      const accepted = await patchQtStatusApi(request, token, proposalId, 'accepted');
      if (!accepted.ok) {
        throw new Error(
          `Wave 1 prerequisite missing: no accepted quote and accept failed (${accepted.status} ${JSON.stringify(accepted.json)})`,
        );
      }
    }

    const first = await convertQtVersionApi(
      request,
      token,
      proposalId,
      versionId,
      `qt-w1-cvt-${proposalId}-a`,
    );
    if (first.status === 403 || first.status === 404) {
      throw new Error(
        `Wave 1 prerequisite missing: convert ${proposalId}/${versionId} (${first.status} ${JSON.stringify(first.json)})`,
      );
    }
    expect(first.ok, `first convert: ${first.status} ${JSON.stringify(first.json)}`).toBeTruthy();
    const second = await convertQtVersionApi(
      request,
      token,
      proposalId,
      versionId,
      `qt-w1-cvt-${proposalId}-b`,
    );
    expect(second.ok, `second convert: ${second.status} ${JSON.stringify(second.json)}`).toBeTruthy();
    expect(second.json.conversion_id).toBe(first.json.conversion_id);
    expect(second.json.lifecycles).toEqual(first.json.lifecycles);
    expect(first.json.lifecycles?.length).toBeGreaterThan(0);
  });

  test('public accept wording is Xác nhận đề xuất', async ({ request }) => {
    const token = await staffToken(request);
    const leadId = await resolveQtLeadId(request, token);
    const created = await createQuoteFromLeadApi(request, token, {
      lead_id: leadId,
      title: `QT-W1-PUB-${Date.now()}`,
    });
    expect(created.ok, `create for public: ${created.status}`).toBeTruthy();
    const minted = await mintQtShareApi(request, token, created.json.proposal!.id);
    expect(minted.ok, `mint share: ${minted.status} ${JSON.stringify(minted.json)}`).toBeTruthy();
    expect(minted.json.token).toBeTruthy();
    const pub = await fetchPublicProposalApi(request, minted.json.token!);
    expect(pub.ok, `public GET: ${pub.status}`).toBeTruthy();
    expect(pub.json.cta?.accept).toBe(QT_PUBLIC_ACCEPT_CTA);
  });

  test('a QT page has exactly one main landmark', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/proposals');
    await expect(page.locator('main')).toHaveCount(1);
  });
});

test.describe('Quotation OS W1 source', () => {
  test('qt components source has no 265647600 mock money', () => {
    assertNoMockMoneyInQtComponents();
  });
});

test.describe('Quotation OS studio + portal OTP', () => {
  test('public HTML has no margin / NSR (always-run markup)', () => {
    const html = renderPortalPublicProposalHtml();
    expect(html).toContain(QT_PUBLIC_ACCEPT_CTA);
    expect(html).toContain('Growth');
    expect(html).toMatch(/otp|OTP/i);
    expect(html).not.toMatch(/ký hợp đồng/i);
    expect(publicHtmlLeaks(html)).toEqual([]);
    expect(publicHtmlLeaks(`${html}<p>NSR 1</p>`)).toContain('NSR');
    expect(publicHtmlLeaks(`${html}<p>margin 22%</p>`)).toContain('margin');
  });

  test('accept option B + OTP from real portal view fields', () => {
    const html = renderPortalPublicProposalHtml();
    expect(html).toContain('value="B"');
    expect(html).toContain('654321');
    expect(html).toContain(QT_PUBLIC_ACCEPT_CTA);
    expect(publicHtmlLeaks(html)).toEqual([]);
  });
});
