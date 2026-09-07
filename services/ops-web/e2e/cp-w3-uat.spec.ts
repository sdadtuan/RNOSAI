import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  CP_W3_REPORT_TABS,
  FOREIGN_ASSET_ID,
  FOREIGN_COLLECTION_ID,
  INVALID_VERSION_ID,
  UNKNOWN_CLIENT,
  addCpCollectionItemApi,
  bulkCpPublishApi,
  cpError,
  createCpCollectionApi,
  fetchCpKpisApi,
  getCpBatchApi,
  getCpBatchErrorsCsv,
  getCpCollectionApi,
  getCpReportApi,
  requireCpVersion,
  requirePreparedBatch,
  retryCpBatchItemApi,
  runCpBatchApi,
  sampleBatchRow,
  staffToken,
  validateCpBatchApi,
} from './helpers/cp-w3-helpers';

test.describe('Creative Production OS W3 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 3 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('batch error CSV lists only invalid and failed rows', async ({ request }) => {
    const token = await staffToken(request);
    const batch = await requirePreparedBatch(request, token, [
      sampleBatchRow(1),
      sampleBatchRow(2, 'hotline'),
      sampleBatchRow(3),
    ]);

    const validated = await validateCpBatchApi(request, token, batch.id);
    expect(
      validated.ok,
      `validate: ${validated.status} ${JSON.stringify(validated.json)}`,
    ).toBeTruthy();
    expect(validated.json.invalid_count).toBe(1);
    expect(validated.json.valid_count).toBe(2);

    const csv = await getCpBatchErrorsCsv(request, token, batch.id);
    expect(csv.ok, `errors.csv: ${csv.status} ${csv.text}`).toBeTruthy();
    expect(csv.text).toMatch(/^row_no,status,error/i);
    expect(csv.text).toContain('2,invalid,missing_mapped_required');
    const dataRows = csv.text.split('\n').map((line) => line.trim()).filter(Boolean).slice(1);
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0]).not.toMatch(/^1,/);
    expect(dataRows[0]).not.toMatch(/^3,/);
  });

  test('retry one row does not re-charge completed rows', async ({ request }) => {
    const token = await staffToken(request);
    const batch = await requirePreparedBatch(request, token, [
      sampleBatchRow(1),
      sampleBatchRow(2, 'hotline'),
      sampleBatchRow(3),
    ]);

    const validated = await validateCpBatchApi(request, token, batch.id);
    expect(validated.ok, `validate: ${validated.status} ${JSON.stringify(validated.json)}`).toBeTruthy();

    const ran = await runCpBatchApi(request, token, batch.id);
    if (ran.status === 403) {
      throw new Error(
        `Wave 3 prerequisite missing: staff lacks crm_cp.render (${ran.status} ${JSON.stringify(ran.json)})`,
      );
    }
    expect(ran.ok, `run: ${ran.status} ${JSON.stringify(ran.json)}`).toBeTruthy();

    const afterRun = await getCpBatchApi(request, token, batch.id);
    expect(afterRun.ok, `get batch: ${afterRun.status} ${JSON.stringify(afterRun.json)}`).toBeTruthy();
    const items = afterRun.json.items ?? [];
    const completed = items.filter((item) => item.status === 'completed');
    const failedOrInvalid = items.filter(
      (item) => item.status === 'failed' || item.status === 'invalid',
    );
    const retryTarget = (
      completed.length > 0 ? failedOrInvalid[0] : undefined
    ) ?? failedOrInvalid[0] ?? completed[0] ?? items[0];
    if (!retryTarget?.row_no) {
      throw new Error(`Wave 3 prerequisite missing: batch ${batch.id} has no retryable rows`);
    }

    const beforeRetry = await fetchCpKpisApi(request, token, 'scope=all');
    const retried = await retryCpBatchItemApi(
      request,
      token,
      batch.id,
      Number(retryTarget.row_no),
    );
    if (retried.status === 403) {
      throw new Error(
        `Wave 3 prerequisite missing: staff lacks crm_cp.render (${retried.status} ${JSON.stringify(retried.json)})`,
      );
    }
    expect(retried.ok, `retry: ${retried.status} ${JSON.stringify(retried.json)}`).toBeTruthy();

    const afterRetry = await getCpBatchApi(request, token, batch.id);
    const credits = await fetchCpKpisApi(request, token, 'scope=all');
    const nextItems = afterRetry.json.items ?? [];

    for (const row of completed) {
      const current = nextItems.find((item) => Number(item.row_no) === Number(row.row_no));
      expect(current?.status).toBe('completed');
      expect(current?.job_id ?? null).toBe(row.job_id ?? null);
    }
    if (retryTarget.status === 'completed') {
      expect(credits.kpis.credits_used).toBe(beforeRetry.kpis.credits_used);
    }
  });

  test('performance report is dash-ready when ingest is missing', async ({ request }) => {
    const token = await staffToken(request);
    const report = await getCpReportApi(
      request,
      token,
      'performance',
      `scope=all&client=${UNKNOWN_CLIENT}`,
    );
    expect(report.ok, `performance: ${report.status} ${JSON.stringify(report.json)}`).toBeTruthy();
    expect(report.json.slug).toBe('performance');
    expect(report.json.funnel == null).toBeTruthy();

    const metrics = report.json.metrics ?? {};
    expect(Object.keys(metrics).length).toBeGreaterThan(0);
    for (const metric of Object.values(metrics)) {
      expect(metric).toEqual(expect.objectContaining({
        value: null,
        source: expect.any(String),
        freshness: null,
      }));
    }
    expect(metrics.ctr?.value ?? null).toBeNull();
    expect(metrics.views?.value ?? null).toBeNull();
  });

  test('smart collection does not leak another book', async ({ request }) => {
    const token = await staffToken(request);
    const created = await createCpCollectionApi(request, token, {
      name: `CP-W3-UAT-smart-${Date.now()}`,
      smart_filter_json: { agency_client_id: UNKNOWN_CLIENT, mime: 'image/' },
    });
    expect(
      created.ok,
      `create collection: ${created.status} ${JSON.stringify(created.json)}`,
    ).toBeTruthy();
    const collectionId = String(created.json.id ?? '');
    expect(collectionId.length).toBeGreaterThan(0);

    const scoped = await getCpCollectionApi(request, token, collectionId, 'scope=me');
    expect(scoped.ok, `get smart: ${scoped.status} ${JSON.stringify(scoped.json)}`).toBeTruthy();
    for (const item of scoped.json.items ?? []) {
      expect(String(item.agency_client_id ?? '')).toBe(UNKNOWN_CLIENT);
    }

    const foreign = await getCpCollectionApi(request, token, FOREIGN_COLLECTION_ID, 'scope=me');
    expect(foreign.status).toBe(404);
    expect(cpError(foreign.json)).toBe('not_found');

    const added = await addCpCollectionItemApi(
      request,
      token,
      collectionId,
      FOREIGN_ASSET_ID,
      'scope=me',
    );
    expect(added.status).toBe(400);
    expect(cpError(added.json)).toBe('smart_collection_readonly');

    const manual = await createCpCollectionApi(request, token, {
      name: `CP-W3-UAT-manual-${Date.now()}`,
    });
    expect(manual.ok, `manual collection: ${manual.status} ${JSON.stringify(manual.json)}`).toBeTruthy();
    const leaked = await addCpCollectionItemApi(
      request,
      token,
      String(manual.json.id),
      FOREIGN_ASSET_ID,
      'scope=me',
    );
    expect(leaked.status).toBe(404);
    expect(cpError(leaked.json)).toBe('not_found');
  });

  test('bulk schedule skips invalid versions', async ({ request }) => {
    const token = await staffToken(request);
    let existingId: string | undefined;
    try {
      existingId = (await requireCpVersion(request, token)).id;
    } catch {
      existingId = undefined;
    }
    const versionIds = existingId
      ? [existingId, INVALID_VERSION_ID]
      : [INVALID_VERSION_ID];

    const scheduled = await bulkCpPublishApi(request, token, {
      video_version_ids: versionIds,
      channel: 'tiktok',
      tz: 'Asia/Ho_Chi_Minh',
      rule: {
        n_per_day: 1,
        windows: [{ start: '09:00', end: '10:00' }],
        weekdays: [1, 2, 3, 4, 5],
      },
    });
    if (scheduled.status === 403) {
      throw new Error(
        `Wave 3 prerequisite missing: staff lacks crm_cp.publish (${scheduled.status} ${JSON.stringify(scheduled.json)})`,
      );
    }
    if (scheduled.status === 400 && cpError(scheduled.json) === 'unknown_channel') {
      throw new Error('Wave 3 prerequisite missing: tiktok channel profile is not seeded');
    }
    expect(
      scheduled.ok,
      `bulk: ${scheduled.status} ${JSON.stringify(scheduled.json)}`,
    ).toBeTruthy();

    const skipped = scheduled.json.skipped ?? [];
    const items = scheduled.json.items ?? [];
    expect(skipped.some((row) => row.video_version_id === INVALID_VERSION_ID)).toBeTruthy();
    expect(items.some((row) => String(row.video_version_id) === INVALID_VERSION_ID)).toBeFalsy();
    expect(items.length + skipped.length).toBe(versionIds.length);
  });

  test('five report tabs render with one main and Vietnamese titles', async ({ page }) => {
    await loginAsStaff(page);

    for (const tab of CP_W3_REPORT_TABS) {
      await page.goto(`${tab.href}${tab.href.includes('?') ? '&' : '?'}scope=all`);
      await expect(page).not.toHaveURL(/\/(?:403|login)(?:\?|$)/);
      await expect(page.locator('main'), tab.slug).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1, name: tab.h1 })).toHaveCount(1);
      await expect(page.getByRole('navigation', { name: 'Báo cáo' }).getByRole('link')).toHaveCount(5);
      await expect(page.locator('main')).not.toContainText('3.840');
      await expect(page.locator('main')).not.toContainText('68.4');
    }

    await page.goto(
      `/crm/creative-os/reports?tab=performance&scope=all&client=${UNKNOWN_CLIENT}`,
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Hiệu quả nội dung' })).toHaveCount(1);
    await expect(page.locator('main')).toContainText('—');
    await expect(page.locator('main')).toContainText('Thiếu nguồn');
  });
});
