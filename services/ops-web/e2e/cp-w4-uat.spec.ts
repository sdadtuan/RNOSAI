import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  FALLBACK_MODEL_ID,
  FORECAST_ASSUMPTION,
  cpError,
  createCpExperimentApi,
  createCpExperimentVariantApi,
  createCpVideoApi,
  findFallbackChild,
  getCpRenderApi,
  getCpVideoApi,
  getCpVideoVersionApi,
  getCpReportApi,
  isFallbackChildKey,
  findCompletedVersionForDraft,
  listCpRendersApi,
  patchCpVideoApi,
  renderCpVideoApi,
  requireCompletedVersion,
  requireCpProject,
  requireFallbackRouting,
  snapshotLanguage,
  stableSnapshot,
  staffToken,
} from './helpers/cp-w4-helpers';

test.describe('Creative Production OS W4 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 4 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('forecast assumption is visible in the credit API and RPT-03 banner', async ({
    request,
    page,
  }) => {
    const token = await staffToken(request);
    const report = await getCpReportApi(request, token, 'credit', 'scope=all');
    expect(report.ok, `credit: ${report.status} ${JSON.stringify(report.json)}`).toBeTruthy();
    expect(report.json.slug).toBe('credit');

    const forecast = report.json.forecast as
      | { value?: number | null; assumption?: string }
      | null
      | undefined;
    const assumption = forecast?.assumption ?? report.json.assumption;
    expect(assumption).toEqual(expect.any(String));
    expect(String(assumption)).toBe(FORECAST_ASSUMPTION);
    expect(String(assumption)).toMatch(/Forecast =/);
    if (forecast && Object.prototype.hasOwnProperty.call(forecast, 'value')) {
      expect(forecast.value === null || typeof forecast.value === 'number').toBeTruthy();
    }

    await loginAsStaff(page);
    await page.goto('/crm/creative-os/reports?tab=credit&scope=all');
    await expect(page).not.toHaveURL(/\/(?:403|login)(?:\?|$)/);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Credit & ngân sách' })).toHaveCount(1);
    const banner = page.locator('[data-rpt="assumption"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Giả định forecast');
    await expect(banner).toContainText('Forecast =');
    await expect(page.locator('main')).not.toContainText('3.840');
    await expect(page.locator('main')).not.toContainText('68.4');
  });

  test('A/B variant does not mutate a completed version snapshot', async ({ request }) => {
    const token = await staffToken(request);
    const fixture = await requireCompletedVersion(request, token);
    const before = await getCpVideoVersionApi(request, token, fixture.version.id);
    expect(before.ok, `version before: ${before.status} ${JSON.stringify(before.json)}`).toBeTruthy();
    const beforeSnap = stableSnapshot(before.json.snapshot_json);

    const experiment = await createCpExperimentApi(request, token, fixture.projectId, {
      name: `CP-W4-UAT-ab-${Date.now()}`,
      variants_json: [],
    });
    if (experiment.status === 403) {
      throw new Error(
        `Wave 4 prerequisite missing: staff lacks crm_cp.edit (${experiment.status} ${JSON.stringify(experiment.json)})`,
      );
    }
    expect(
      experiment.ok,
      `create experiment: ${experiment.status} ${JSON.stringify(experiment.json)}`,
    ).toBeTruthy();
    expect(String(experiment.json.id ?? '')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const variant = await createCpExperimentVariantApi(request, token, String(experiment.json.id), {
      draft_id: fixture.draftId,
      source_version_id: fixture.version.id,
      label: 'B',
    });
    expect(
      variant.ok,
      `create variant: ${variant.status} ${JSON.stringify(variant.json)}`,
    ).toBeTruthy();
    expect(String(variant.json.version?.id ?? '')).not.toBe(fixture.version.id);
    expect(variant.json.version?.snapshot_json).toEqual(expect.objectContaining({
      experiment_id: experiment.json.id,
    }));

    const after = await getCpVideoVersionApi(request, token, fixture.version.id);
    expect(after.ok, `version after: ${after.status} ${JSON.stringify(after.json)}`).toBeTruthy();
    expect(stableSnapshot(after.json.snapshot_json)).toBe(beforeSnap);
  });

  test('model fallback creates a child job with parent_job_id and :r key', async ({ request }) => {
    const token = await staffToken(request);
    await requireFallbackRouting(request, token);

    const project = await requireCpProject(request, token);
    const created = await createCpVideoApi(request, token, {
      project_id: project.id,
      name: `CP-W4-UAT-fallback-${Date.now()}`,
      input_mode: 'prompt',
      prompt: 'Wave 4 fallback UAT',
      config_json: { language: 'vi', estimated_credits: 1, model: 'stub-pro' },
    });
    if (!created.ok || !created.json.id) {
      throw new Error(
        `Wave 4 prerequisite missing: cannot create fallback draft (${created.status} ${JSON.stringify(created.json)})`,
      );
    }

    const submitKey = `cp-w4-fallback-${crypto.randomUUID()}`;
    const submitted = await renderCpVideoApi(
      request,
      token,
      String(created.json.id),
      submitKey,
    );
    if (submitted.status === 403) {
      throw new Error(
        `Wave 4 prerequisite missing: staff lacks crm_cp.render (${submitted.status} ${JSON.stringify(submitted.json)})`,
      );
    }

    const listed = await listCpRendersApi(request, token);
    expect(listed.ok, `list renders: ${listed.status} ${JSON.stringify(listed.json)}`).toBeTruthy();
    const submitIsChild = Boolean(
      submitted.json.parent_job_id
      && String(submitted.json.idempotency_key ?? '').startsWith(`${submitKey}:r`),
    );
    const parentId = String(
      submitIsChild
        ? submitted.json.parent_job_id
        : (submitted.json.job_id ?? submitted.json.id ?? ''),
    );
    const child = findFallbackChild(listed.json.items, parentId, submitKey)
      ?? (submitIsChild && String(submitted.json.parent_job_id) === parentId
        ? submitted.json
        : undefined);

    if (!child) {
      throw new Error(
        'Wave 4 prerequisite missing: stub completed without a failed parent, so no fallback child (parent_job_id + :r) was created',
      );
    }

    expect(child.parent_job_id).toBe(parentId);
    expect(String(child.idempotency_key ?? '').startsWith(`${submitKey}:r`)).toBeTruthy();
    expect(isFallbackChildKey(child.idempotency_key)).toBeTruthy();
    if (child.id) {
      const fetched = await getCpRenderApi(request, token, String(child.id));
      expect(fetched.ok, `get child: ${fetched.status} ${JSON.stringify(fetched.json)}`).toBeTruthy();
      expect(fetched.json.parent_job_id).toBe(child.parent_job_id);
      expect(isFallbackChildKey(fetched.json.idempotency_key)).toBeTruthy();
    }
    expect(FALLBACK_MODEL_ID).toBe('stub-lite');
  });

  test('locale pack does not change snapshot language of a completed output', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const project = await requireCpProject(request, token);
    const created = await createCpVideoApi(request, token, {
      project_id: project.id,
      name: `CP-W4-UAT-locale-${Date.now()}`,
      input_mode: 'prompt',
      prompt: 'Wave 4 locale UAT',
      config_json: { language: 'vi', estimated_credits: 1 },
    });
    if (!created.ok || !created.json.id) {
      throw new Error(
        `Wave 4 prerequisite missing: cannot create locale draft (${created.status} ${JSON.stringify(created.json)})`,
      );
    }
    const draftId = String(created.json.id);

    const rendered = await renderCpVideoApi(
      request,
      token,
      draftId,
      `cp-w4-locale-${crypto.randomUUID()}`,
    );
    if (rendered.status === 403) {
      throw new Error(
        `Wave 4 prerequisite missing: staff lacks crm_cp.render (${rendered.status} ${JSON.stringify(rendered.json)})`,
      );
    }
    if (!rendered.ok) {
      throw new Error(
        `Wave 4 prerequisite missing: locale draft cannot render (${rendered.status} ${JSON.stringify(rendered.json)})`,
      );
    }

    const match = await findCompletedVersionForDraft(request, token, draftId);
    if (!match?.id) {
      throw new Error(`Wave 4 prerequisite missing: locale draft ${draftId} has no completed version`);
    }
    const before = await getCpVideoVersionApi(request, token, match.id);
    expect(before.ok, `locale version: ${before.status} ${JSON.stringify(before.json)}`).toBeTruthy();
    const beforeLanguage = snapshotLanguage(before.json.snapshot_json);
    expect(beforeLanguage).toBe('vi');
    const beforeSnap = stableSnapshot(before.json.snapshot_json);

    const patched = await patchCpVideoApi(request, token, draftId, {
      config_json: { language: 'en', estimated_credits: 1 },
    });
    expect(patched.ok, `patch locale: ${patched.status} ${JSON.stringify(patched.json)}`).toBeTruthy();
    expect(patched.json.config_json?.language ?? null).not.toBe('en');

    const afterDraft = await getCpVideoApi(request, token, draftId);
    expect(afterDraft.json.config_json?.language ?? null).not.toBe('en');

    const after = await getCpVideoVersionApi(request, token, match.id);
    expect(after.ok, `locale after: ${after.status} ${JSON.stringify(after.json)}`).toBeTruthy();
    expect(snapshotLanguage(after.json.snapshot_json)).toBe(beforeLanguage);
    expect(stableSnapshot(after.json.snapshot_json)).toBe(beforeSnap);
    expect(cpError(patched.json) ?? null).not.toBe('immutable');
  });
});
