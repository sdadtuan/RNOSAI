import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  QT_LOST_REASONS,
  QT_PUBLIC_ACCEPT_CTA,
  QT_REPORT_TAB_ALIAS,
  QT_REPORT_TAB_IDS,
  QT_REPORT_TAB_SLUGS,
  QT_VID_TPL_01,
  acceptAndConvertTwice,
  assertQtW3SourceGuards,
  convertQtVersionApi,
  ensureHandoffVideo,
  fetchQtReportsApi,
  generateQtProposalApi,
  getQtLinesApi,
  getQtProposalApi,
  importQtCatalogApi,
  listQtQuotesApi,
  patchQtStatusApi,
  publishWorkingQuote,
  qtApiError,
  restoreHandoffVideo,
  seedBrandFilmLine,
  seedQtWorkingQuote,
  staffToken,
} from './helpers/qt-w3-helpers';

test.describe('Quotation OS W3 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 3 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('AC-08 convert twice same lifecycle ids', async ({ request }) => {
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
      const seeded = await seedQtWorkingQuote(request, token, `QT-W3-AC08-${Date.now()}`);
      proposalId = seeded.proposalId;
      versionId = seeded.versionId;
      const { first, second } = await acceptAndConvertTwice(
        request,
        token,
        seeded,
        `qt-w3-ac08-${proposalId}`,
      );
      expect(second.json.conversion_id).toBe(first.json.conversion_id);
      expect(second.json.lifecycles).toEqual(first.json.lifecycles);
      expect(first.json.lifecycles?.length).toBeGreaterThan(0);
      return;
    }

    const first = await convertQtVersionApi(
      request,
      token,
      proposalId,
      versionId,
      `qt-w3-ac08-${proposalId}-a`,
    );
    if (first.status === 403 || first.status === 404) {
      throw new Error(
        `Wave 3 prerequisite missing: convert ${proposalId}/${versionId} (${first.status} ${JSON.stringify(first.json)})`,
      );
    }
    expect(first.ok, `first convert: ${first.status} ${JSON.stringify(first.json)}`).toBeTruthy();
    const second = await convertQtVersionApi(
      request,
      token,
      proposalId,
      versionId,
      `qt-w3-ac08-${proposalId}-b`,
    );
    expect(second.ok, `second convert: ${second.status} ${JSON.stringify(second.json)}`).toBeTruthy();
    expect(second.json.conversion_id).toBe(first.json.conversion_id);
    expect(second.json.lifecycles).toEqual(first.json.lifecycles);
    expect(first.json.lifecycles?.length).toBeGreaterThan(0);
  });

  test('AC-10 Brand Film convert → vd_project + VID-TPL-01, no QT editor', async ({ request }) => {
    const token = await staffToken(request);
    const handoff = await ensureHandoffVideo(request, token);
    try {
      const seeded = await seedQtWorkingQuote(request, token, `QT-W3-AC10-${Date.now()}`);
      await seedBrandFilmLine(request, token, seeded.proposalId);
      const { first, second } = await acceptAndConvertTwice(
        request,
        token,
        seeded,
        `qt-w3-ac10-${seeded.proposalId}`,
      );
      expect(second.json.conversion_id).toBe(first.json.conversion_id);
      expect(second.json.optional_handoff).toEqual(first.json.optional_handoff);
      const handoffs = first.json.optional_handoff ?? [];
      expect(handoffs.length).toBeGreaterThan(0);
      expect(handoffs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            vd_project_id: expect.any(Number),
            template_key: QT_VID_TPL_01,
          }),
        ]),
      );
      expect(handoffs.some((row) => Number(row.vd_project_id) > 0)).toBeTruthy();
    } finally {
      await restoreHandoffVideo(request, token, handoff.previous);
    }
  });

  test('five report tabs executive|funnel|margin|loss|engagement / rpt-01…05', async ({
    request,
    page,
  }) => {
    const token = await staffToken(request);
    for (const slug of QT_REPORT_TAB_SLUGS) {
      const report = await fetchQtReportsApi(request, token, slug);
      if (slug === 'margin' && report.status === 403) {
        throw new Error(
          `Wave 3 prerequisite missing: crm_quote.finance for RPT-03 (${report.status} ${JSON.stringify(report.json)})`,
        );
      }
      expect(report.ok, `reports?tab=${slug}: ${report.status} ${JSON.stringify(report.json)}`).toBeTruthy();
      expect(report.json.tab).toBe(slug);
    }
    for (const id of QT_REPORT_TAB_IDS) {
      const report = await fetchQtReportsApi(request, token, id);
      expect(report.ok, `reports?tab=${id}: ${report.status}`).toBeTruthy();
      expect(report.json.tab).toBe(QT_REPORT_TAB_ALIAS[id]);
    }

    await loginAsStaff(page);
    await page.goto('/crm/proposals/reports?tab=executive&scope=all');
    await expect(page.locator('.qt-tab')).toHaveCount(5);
    await expect(page.locator('main')).toContainText(/Điều hành|Funnel|Margin|Lý do thua|Tương tác/);
    await expect(page.locator('main')).not.toContainText('265.647.600');
  });

  test('reject without lost_reason → 400', async ({ request }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W3-LOST-${Date.now()}`);
    const missing = await patchQtStatusApi(request, token, seeded.proposalId, 'rejected');
    expect(missing.ok).toBeFalsy();
    expect(missing.status).toBe(400);
    expect(qtApiError(missing.json)).toBe('lost_reason_required');

    const invalid = await patchQtStatusApi(request, token, seeded.proposalId, 'rejected', {
      lost_reason: 'not-a-reason',
    });
    expect(invalid.ok).toBeFalsy();
    expect(invalid.status).toBe(400);
    expect(qtApiError(invalid.json)).toBe('lost_reason_invalid');
    expect(QT_LOST_REASONS).toEqual(['budget', 'competitor', 'priority', 'scope', 'other']);
  });

  test('import then published snapshot unchanged', async ({ request }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W3-IMP-${Date.now()}`);
    await publishWorkingQuote(request, token, seeded);
    const before = await getQtLinesApi(request, token, seeded.proposalId);
    expect(before.ok, `lines before import: ${before.status}`).toBeTruthy();
    const line = before.json.lines?.[0];
    expect(line?.dv_code).toBeTruthy();
    const frozenSnap = JSON.stringify(line?.catalog_snapshot_json ?? {});
    const frozenPrice = String(line?.unit_price_vnd ?? '');
    const dvCode = String(line?.dv_code);

    const imported = await importQtCatalogApi(request, token, {
      filename: `qt-w3-uat-${Date.now()}.json`,
      json: {
        rate_cards: [
          {
            dv_code: dvCode,
            package_tier: String(line?.package_tier ?? 'standard'),
            fee_vnd: 99_000_000,
            cost_labor_vnd: 40_000_000,
            effective_from: '2026-09-09',
            state: 'active',
          },
        ],
        revisions: [{ catalog_service_id: dvCode, profile_json: { fee_vnd: 99_000_000 } }],
      },
    });
    if (imported.status === 403) {
      throw new Error(
        `Wave 3 prerequisite missing: crm_quote.catalog manage (${imported.status} ${JSON.stringify(imported.json)})`,
      );
    }
    expect(imported.ok, `import: ${imported.status} ${JSON.stringify(imported.json)}`).toBeTruthy();
    expect(imported.json.state).toBe('done');

    const after = await getQtLinesApi(request, token, seeded.proposalId);
    expect(JSON.stringify(after.json.lines?.[0]?.catalog_snapshot_json ?? {})).toBe(frozenSnap);
    expect(String(after.json.lines?.[0]?.unit_price_vnd ?? '')).toBe(frozenPrice);
  });

  test('POST /:id/generate 404 qt_ai_disabled when QT_AI_ENABLED unset', async ({ request }) => {
    expect(process.env.QT_AI_ENABLED === undefined || process.env.QT_AI_ENABLED === '').toBe(true);
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W3-AI-${Date.now()}`);
    const generated = await generateQtProposalApi(request, token, seeded.proposalId);
    expect(generated.ok).toBeFalsy();
    expect(generated.status).toBe(404);
    expect(qtApiError(generated.json)).toBe('qt_ai_disabled');
  });
});

test.describe('Quotation OS W3 source', () => {
  test('five report tabs + no QT editor + CTA + no mock money (always-run markup)', () => {
    assertQtW3SourceGuards();
    expect(QT_PUBLIC_ACCEPT_CTA).toBe('Xác nhận đề xuất');
    expect(QT_REPORT_TAB_SLUGS).toEqual(['executive', 'funnel', 'margin', 'loss', 'engagement']);
    expect(QT_REPORT_TAB_IDS).toEqual(['rpt-01', 'rpt-02', 'rpt-03', 'rpt-04', 'rpt-05']);
  });

  test('qt product UI source has no 265647600 / 22,4 / 8,46 mock money', () => {
    assertQtW3SourceGuards();
  });
});
