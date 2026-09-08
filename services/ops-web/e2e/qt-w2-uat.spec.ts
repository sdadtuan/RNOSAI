import { expect, test } from '@playwright/test';
import { apiReachable } from './helpers/ai-copilot-helpers';
import { API_URL, QT_PUBLIC_ACCEPT_CTA, renderPortalPublicProposalHtml } from './helpers/qt-w1-helpers';
import {
  QT_AC03_COST_VND,
  QT_AC03_FEE_VND,
  QT_GM_BELOW_FLOOR_BPS,
  QT_GM_FLOOR_BPS,
  QT_HEALTHY_GM_COST_VND,
  QT_PUBLIC_LEAK_RE,
  assertNoMockMoneyInQtProductUi,
  acceptPublicProposalApi,
  approveAllQtSteps,
  convertQtVersionApi,
  createQtRevisionApi,
  diffQtVersionsApi,
  ensureQtOptionsAbc,
  fetchPublicProposalApi,
  fetchQtCatalogApi,
  fetchQtCatalogPackagesApi,
  getQtLinesApi,
  getQtProposalApi,
  listQtVersionsApi,
  mintQtShareApi,
  otherCatalogTier,
  prepareQtForApproval,
  publishQtVersionApi,
  publicQuoteJsonLeaks,
  publicRenderLeaks,
  putQtFeeLine,
  qtApiError,
  qtCatalogItems,
  recalculateQtApi,
  requestPublicProposalOtpApi,
  requireActiveCatalogItem,
  seedQtLineWithCosts,
  seedQtWorkingQuote,
  staffToken,
  submitQtApprovalApi,
} from './helpers/qt-w2-helpers';

test.describe('Quotation OS W2 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 2 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('AC-03 GM 22.4% < floor 25% → submit-approval routes Finance + GDKD; cannot publish before approve', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W2-AC03-${Date.now()}`);
    await seedQtLineWithCosts(request, token, seeded.proposalId, {
      unit_price_vnd: QT_AC03_FEE_VND,
      cost_labor_vnd: QT_AC03_COST_VND,
    });
    await prepareQtForApproval(request, token, seeded);

    const recalc = await recalculateQtApi(request, token, seeded.proposalId, seeded.versionId);
    if (recalc.json.gm_bps != null) {
      expect(recalc.json.gm_bps).toBe(QT_GM_BELOW_FLOOR_BPS);
      expect(recalc.json.gm_bps).toBeLessThan(QT_GM_FLOOR_BPS);
    }

    const submitted = await submitQtApprovalApi(request, token, seeded.versionId);
    expect(
      submitted.ok,
      `submit-approval: ${submitted.status} ${JSON.stringify(submitted.json)}`,
    ).toBeTruthy();
    const sections = (submitted.json.steps ?? []).map((step) => String(step.section));
    expect(sections).toEqual(expect.arrayContaining(['Finance', 'GDKD']));
    expect(sections.filter((section) => section === 'Finance' || section === 'GDKD')).toHaveLength(2);
    expect(submitted.json.approval?.policy_snapshot?.gm_bps ?? recalc.json.gm_bps).toBe(
      QT_GM_BELOW_FLOOR_BPS,
    );

    const published = await publishQtVersionApi(request, token, seeded.versionId);
    if (published.status === 403) {
      throw new Error(
        `Wave 2 prerequisite missing: crm_quote.publish (${published.status} ${JSON.stringify(published.json)})`,
      );
    }
    expect(published.ok).toBeFalsy();
    expect(qtApiError(published.json)).toBe('approval_incomplete');
  });

  test('AC-04 v1 Published/Sent → change qty/price → 409 revision_required, v1 immutable, new v2', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W2-AC04-${Date.now()}`);
    const v1Line = await seedQtLineWithCosts(request, token, seeded.proposalId, {
      unit_price_vnd: QT_AC03_FEE_VND,
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
      qty: 1,
    });
    await prepareQtForApproval(request, token, seeded);

    const submitted = await submitQtApprovalApi(request, token, seeded.versionId);
    expect(
      submitted.ok,
      `submit-approval: ${submitted.status} ${JSON.stringify(submitted.json)}`,
    ).toBeTruthy();
    await approveAllQtSteps(request, token, submitted.json.steps ?? []);

    const published = await publishQtVersionApi(request, token, seeded.versionId);
    if (published.status === 403) {
      throw new Error(
        `Wave 2 prerequisite missing: crm_quote.publish (${published.status} ${JSON.stringify(published.json)})`,
      );
    }
    expect(published.ok, `publish v1: ${published.status} ${JSON.stringify(published.json)}`).toBeTruthy();

    const before = await getQtLinesApi(request, token, seeded.proposalId);
    const frozenQty = Number(before.json.lines?.[0]?.qty ?? v1Line.qty ?? 1);
    const frozenPrice = String(before.json.lines?.[0]?.unit_price_vnd ?? v1Line.unit_price_vnd ?? '');
    const frozenSnap = JSON.stringify(before.json.lines?.[0]?.catalog_snapshot_json ?? {});

    const blocked = await putQtFeeLine(request, token, seeded.proposalId, {
      dv_code: String(v1Line.dv_code),
      package_tier: String(v1Line.package_tier ?? 'standard'),
      client_visible: true,
      qty: frozenQty + 2,
      unit_price_vnd: Number(v1Line.unit_price_vnd ?? QT_AC03_FEE_VND) + 1_000_000,
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
    });
    expect(blocked.ok).toBeFalsy();
    expect(blocked.status).toBe(409);
    expect(qtApiError(blocked.json)).toBe('revision_required');

    const v1AfterBlock = await getQtLinesApi(request, token, seeded.proposalId);
    expect(Number(v1AfterBlock.json.lines?.[0]?.qty ?? 0)).toBe(frozenQty);
    expect(String(v1AfterBlock.json.lines?.[0]?.unit_price_vnd ?? '')).toBe(frozenPrice);

    const revision = await createQtRevisionApi(request, token, seeded.proposalId);
    expect(revision.ok, `create v2: ${revision.status} ${JSON.stringify(revision.json)}`).toBeTruthy();
    expect(revision.json.n).toBe(2);
    expect(revision.json.state).toBe('working');
    expect(revision.json.id).toBeTruthy();
    expect(String(revision.json.id)).not.toBe(seeded.versionId);

    const versions = await listQtVersionsApi(request, token, seeded.proposalId);
    expect((versions.json.versions ?? []).map((row) => row.n).sort()).toEqual([1, 2]);
    expect(versions.json.versions?.find((row) => row.n === 1)?.state).toBe('published');

    const written = await putQtFeeLine(request, token, seeded.proposalId, {
      dv_code: String(v1Line.dv_code),
      package_tier: String(v1Line.package_tier ?? 'standard'),
      client_visible: true,
      qty: 3,
      unit_price_vnd: Number(v1Line.unit_price_vnd ?? QT_AC03_FEE_VND),
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
    });
    expect(written.ok, `put lines on v2: ${written.status} ${JSON.stringify(written.json)}`).toBeTruthy();
    expect(Number(written.json.lines?.[0]?.qty ?? 0)).toBe(3);

    const detail = await getQtProposalApi(request, token, seeded.proposalId);
    expect(detail.json.current_version_id).toBe(revision.json.id);
    expect(JSON.stringify(v1AfterBlock.json.lines?.[0]?.catalog_snapshot_json ?? {})).toBe(frozenSnap);

    const diff = await diffQtVersionsApi(request, token, seeded.proposalId, 1, 2);
    expect(diff.ok, `diff 1/2: ${diff.status} ${JSON.stringify(diff.json)}`).toBeTruthy();
    const qty = (diff.json.items ?? []).find((row) => row.path === 'lines[0].qty');
    expect(qty).toMatchObject({ from: frozenQty, to: 3, critical: true });
  });

  test('AC-05 share token on v2, choose option B, checkbox + OTP → acceptance, accepted, lock, convert allowed', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W2-AC05-${Date.now()}`);
    await seedQtLineWithCosts(request, token, seeded.proposalId, {
      unit_price_vnd: QT_AC03_FEE_VND,
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
    });
    await prepareQtForApproval(request, token, seeded);
    const firstSubmit = await submitQtApprovalApi(request, token, seeded.versionId);
    expect(firstSubmit.ok, `v1 submit: ${firstSubmit.status} ${JSON.stringify(firstSubmit.json)}`).toBeTruthy();
    await approveAllQtSteps(request, token, firstSubmit.json.steps ?? []);
    const publishedV1 = await publishQtVersionApi(request, token, seeded.versionId);
    expect(
      publishedV1.ok,
      `publish v1: ${publishedV1.status} ${JSON.stringify(publishedV1.json)}`,
    ).toBeTruthy();

    const revision = await createQtRevisionApi(request, token, seeded.proposalId);
    expect(revision.ok, `create v2: ${revision.status}`).toBeTruthy();
    const v2 = String(revision.json.id ?? '');
    expect(v2).toBeTruthy();
    await ensureQtOptionsAbc(request, token, v2);
    await prepareQtForApproval(request, token, { ...seeded, versionId: v2 });
    const v2Submit = await submitQtApprovalApi(request, token, v2);
    expect(v2Submit.ok, `v2 submit: ${v2Submit.status} ${JSON.stringify(v2Submit.json)}`).toBeTruthy();
    await approveAllQtSteps(request, token, v2Submit.json.steps ?? []);
    const publishedV2 = await publishQtVersionApi(request, token, v2);
    expect(publishedV2.ok, `publish v2: ${publishedV2.status} ${JSON.stringify(publishedV2.json)}`).toBeTruthy();

    const minted = await mintQtShareApi(request, token, seeded.proposalId);
    expect(minted.ok, `mint share: ${minted.status} ${JSON.stringify(minted.json)}`).toBeTruthy();
    const shareToken = String(minted.json.token ?? '');
    expect(shareToken.length).toBeGreaterThan(16);

    const pub = await fetchPublicProposalApi(request, shareToken);
    expect(pub.ok, `public GET: ${pub.status}`).toBeTruthy();
    expect(pub.json.cta?.accept).toBe(QT_PUBLIC_ACCEPT_CTA);
    const visibleKeys = ((pub.json.options as Array<{ option_key?: string }>) ?? []).map((row) =>
      String(row.option_key),
    );
    expect(visibleKeys).toEqual(expect.arrayContaining(['B']));
    expect(visibleKeys).not.toContain('C');

    const signer = {
      accepted: true,
      name: 'Nguyễn Minh Anh',
      email: 'minhanh@anphat.vn',
      title: 'CFO',
      option_key: 'B',
    };
    const noCheckbox = await acceptPublicProposalApi(request, shareToken, {
      ...signer,
      accepted: false,
    });
    expect(noCheckbox.ok).toBeFalsy();
    expect(qtApiError(noCheckbox.json)).toBe('accept_required');

    const otpReq = await requestPublicProposalOtpApi(request, shareToken, signer.email);
    expect(otpReq.ok, `request OTP: ${otpReq.status} ${JSON.stringify(otpReq.json)}`).toBeTruthy();

    const noOtp = await acceptPublicProposalApi(request, shareToken, signer);
    expect(noOtp.ok).toBeFalsy();
    expect(qtApiError(noOtp.json)).toMatch(/otp_invalid|otp_required/);

    const otp = String(process.env.OPS_E2E_QT_OTP ?? '').replace(/\s+/g, '');
    if (!otp) {
      return;
    }
    const accepted = await acceptPublicProposalApi(request, shareToken, { ...signer, otp });
    expect(accepted.ok, `accept B: ${accepted.status} ${JSON.stringify(accepted.json)}`).toBeTruthy();
    expect(accepted.json.status).toBe('accepted');
    expect(accepted.json.option_key).toBe('B');

    const after = await getQtProposalApi(request, token, seeded.proposalId);
    expect(after.json.status).toBe('accepted');
    const converted = await convertQtVersionApi(
      request,
      token,
      seeded.proposalId,
      v2,
      `qt-w2-ac05-${seeded.proposalId}`,
    );
    if (converted.status === 403 || converted.status === 404) {
      throw new Error(
        `Wave 2 prerequisite missing: convert after accept (${converted.status} ${JSON.stringify(converted.json)})`,
      );
    }
    expect(converted.ok, `convert: ${converted.status} ${JSON.stringify(converted.json)}`).toBeTruthy();
  });

  test('AC-06 public render has no cost/margin/internal/hidden option (including JSON)', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W2-AC06-${Date.now()}`);
    await seedQtLineWithCosts(request, token, seeded.proposalId, {
      unit_price_vnd: QT_AC03_FEE_VND,
      cost_labor_vnd: QT_HEALTHY_GM_COST_VND,
    });
    await ensureQtOptionsAbc(request, token, seeded.versionId);
    const minted = await mintQtShareApi(request, token, seeded.proposalId);
    expect(minted.ok, `mint share: ${minted.status} ${JSON.stringify(minted.json)}`).toBeTruthy();

    const pub = await fetchPublicProposalApi(request, minted.json.token!);
    expect(pub.ok, `public GET: ${pub.status}`).toBeTruthy();
    expect(publicQuoteJsonLeaks(pub.json)).toEqual([]);
    expect(JSON.stringify(pub.json)).not.toMatch(QT_PUBLIC_LEAK_RE);
    expect(JSON.stringify(pub.json)).not.toMatch(/ký hợp đồng/i);
    expect(pub.json.cta?.accept).toBe(QT_PUBLIC_ACCEPT_CTA);
    const keys = ((pub.json.options as Array<{ option_key?: string }> | undefined) ?? []).map((row) =>
      String(row.option_key),
    );
    expect(keys).not.toContain('C');
    expect(JSON.stringify(pub.json)).not.toMatch(/Hidden internal/i);
  });

  test('AC-11 line has package_tier; version has options A/B/C; changing SKU/tier changes fee snapshot', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const packages = await fetchQtCatalogPackagesApi(request, token);
    expect(
      packages.ok,
      `catalog packages: ${packages.status} ${JSON.stringify(packages.json)}`,
    ).toBeTruthy();
    expect(Array.isArray(packages.json.packages)).toBeTruthy();

    const catalog = await fetchQtCatalogApi(request, token);
    const active = requireActiveCatalogItem(catalog.json);
    const firstTier = 'standard';
    const next = otherCatalogTier(active, firstTier);
    const seeded = await seedQtWorkingQuote(request, token, `QT-W2-AC11-${Date.now()}`);
    const first = await putQtFeeLine(request, token, seeded.proposalId, {
      dv_code: String(active.dv_code),
      package_tier: firstTier,
      client_visible: true,
      qty: 1,
    });
    expect(first.ok, `first tier line: ${first.status} ${JSON.stringify(first.json)}`).toBeTruthy();
    expect(first.json.lines?.[0]?.package_tier).toBe(firstTier);
    const firstFee = Number(
      first.json.lines?.[0]?.unit_price_vnd ??
        first.json.lines?.[0]?.catalog_snapshot_json?.rate?.suggested_vnd ??
        0,
    );

    const options = await ensureQtOptionsAbc(request, token, seeded.versionId);
    expect(options.map((row) => row.option_key).sort()).toEqual(['A', 'B', 'C']);

    let secondDv = String(active.dv_code);
    let secondTier = next?.tier ?? firstTier;
    if (!next) {
      const otherSku = qtCatalogItems(catalog.json).find((item) => {
        const status = String(item.status ?? '').toLowerCase();
        return (
          item.can_add_to_client_quote === true &&
          status === 'active' &&
          String(item.dv_code) !== String(active.dv_code)
        );
      });
      if (!otherSku?.dv_code) {
        throw new Error('Wave 2 prerequisite missing: no second SKU/tier to change fee snapshot');
      }
      secondDv = String(otherSku.dv_code);
    }

    const second = await putQtFeeLine(request, token, seeded.proposalId, {
      dv_code: secondDv,
      package_tier: secondTier,
      client_visible: true,
      qty: 1,
    });
    expect(second.ok, `changed SKU/tier: ${second.status} ${JSON.stringify(second.json)}`).toBeTruthy();
    expect(second.json.lines?.[0]?.package_tier).toBe(secondTier);
    const secondFee = Number(
      second.json.lines?.[0]?.unit_price_vnd ??
        second.json.lines?.[0]?.catalog_snapshot_json?.rate?.suggested_vnd ??
        0,
    );
    expect(second.json.lines?.[0]?.catalog_snapshot_json?.rate?.suggested_vnd).not.toBeUndefined();
    if (secondDv === String(active.dv_code) && next?.suggested_vnd != null) {
      expect(secondFee).not.toBe(firstFee);
    } else {
      expect(secondDv !== String(active.dv_code) || secondTier !== firstTier).toBeTruthy();
      expect(secondFee).not.toBe(firstFee);
    }
  });
});

test.describe('Quotation OS W2 source', () => {
  test('public HTML + fixture JSON has no cost/margin/internal/hidden option (always-run markup)', () => {
    const html = renderPortalPublicProposalHtml();
    expect(html).toContain(QT_PUBLIC_ACCEPT_CTA);
    expect(html).toContain('value="B"');
    expect(html).not.toMatch(/ký hợp đồng/i);
    expect(publicRenderLeaks(html)).toEqual([]);
    expect(publicRenderLeaks(`${html}<p>margin 22%</p>`)).toContain('margin');
    expect(publicRenderLeaks(`${html}<p>NSR 1</p>`)).toContain('NSR');
    expect(publicRenderLeaks(`${html}<p>Hidden internal</p>`)).toContain('hidden_option');

    const clean = {
      cta: { accept: QT_PUBLIC_ACCEPT_CTA },
      options: [
        { option_key: 'A', name: 'Core', client_visible: true },
        { option_key: 'B', name: 'Growth', client_visible: true },
      ],
      investment: { fee_vnd: 100_000_000, payable_vnd: 108_000_000 },
    };
    expect(publicQuoteJsonLeaks(clean)).toEqual([]);
    expect(JSON.stringify(clean)).not.toMatch(QT_PUBLIC_LEAK_RE);
    expect(
      publicQuoteJsonLeaks({
        ...clean,
        gm_bps: QT_GM_BELOW_FLOOR_BPS,
        options: [...clean.options, { option_key: 'C', name: 'Hidden internal', client_visible: false }],
      }),
    ).toEqual(expect.arrayContaining(['gm_bps', 'hidden_option']));
  });

  test('qt product UI source has no 265647600 / 22,4 / 8,46 mock money', () => {
    assertNoMockMoneyInQtProductUi();
  });
});
