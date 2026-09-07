import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  BLOCKING_QC_FACTS,
  CP_W2_NAV,
  LOCKED_OVERLAY,
  PASSING_QC_FACTS,
  cpError,
  createCpVideoApi,
  expiredRightsDate,
  exportCpVideoVersionApi,
  extractUsedAssetIds,
  HUB_UNAVAILABLE_ERRORS,
  isHubUnavailable,
  listCpVideosApi,
  regenerateCpSceneApi,
  requireCpProject,
  requireCpVersion,
  runCpQcApi,
  scheduleCpPublishApi,
  setCpAssetRightsApi,
  staffToken,
  submitCpApprovalApi,
  submitCpCreativeApi,
  putCpScenesApi,
} from './helpers/cp-w2-helpers';

test.describe('Creative Production OS W2 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 2 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('QC blocked export returns 409 qc_blocked', async ({ request }) => {
    const token = await staffToken(request);
    const version = await requireCpVersion(request, token);

    const qc = await runCpQcApi(request, token, version.id, BLOCKING_QC_FACTS);
    expect(qc.ok, `QC run: ${qc.status} ${JSON.stringify(qc.json)}`).toBeTruthy();

    const exported = await exportCpVideoVersionApi(request, token, version.id);
    if (exported.status === 403) {
      throw new Error(
        `Wave 2 prerequisite missing: staff lacks crm_cp.export_final (${exported.status} ${JSON.stringify(exported.json)})`,
      );
    }
    expect(exported.status).toBe(409);
    expect(cpError(exported.json)).toBe('qc_blocked');
  });

  test('Hub submit returns 201 creative_id or a documented Hub contract', async ({ request }) => {
    const token = await staffToken(request);
    const version = await requireCpVersion(request, token);
    const projectId = version.project_id;
    if (!projectId) {
      throw new Error(`Wave 2 prerequisite missing: version ${version.id} has no project_id`);
    }

    const qc = await runCpQcApi(request, token, version.id, PASSING_QC_FACTS);
    expect(qc.ok, `QC pass before Hub: ${qc.status} ${JSON.stringify(qc.json)}`).toBeTruthy();

    const submitted = await submitCpCreativeApi(request, token, projectId, version.id);
    if (submitted.status === 201) {
      expect(submitted.json.creative_id).toEqual(expect.any(String));
      expect(String(submitted.json.creative_id).length).toBeGreaterThan(0);
      return;
    }
    if (isHubUnavailable(submitted.status, submitted.json)) {
      expect(HUB_UNAVAILABLE_ERRORS).toContain(cpError(submitted.json));
      return;
    }
    throw new Error(
      `Hub submit unexpected: ${submitted.status} ${JSON.stringify(submitted.json)}`,
    );
  });

  test('schedule of a client_review version returns 409', async ({ request }) => {
    const token = await staffToken(request);
    const version = await requireCpVersion(request, token);

    const approval = await submitCpApprovalApi(request, token, version.id, 'client_review');
    expect(
      approval.ok,
      `set client_review: ${approval.status} ${JSON.stringify(approval.json)}`,
    ).toBeTruthy();

    const scheduled = await scheduleCpPublishApi(request, token, {
      video_version_id: version.id,
      channel: 'tiktok',
    });
    expect(scheduled.status).toBe(409);
    expect(cpError(scheduled.json)).toBe('not_final_approved');
  });

  test('locked scene regenerate does not change overlay', async ({ request }) => {
    const token = await staffToken(request);
    const project = await requireCpProject(request, token);
    const created = await createCpVideoApi(request, token, {
      project_id: project.id,
      name: `CP-W2-UAT-lock-${Date.now()}`,
      input_mode: 'prompt',
      prompt: 'Wave 2 locked-scene UAT',
    });
    if (!created.ok || !created.json.id) {
      const existing = await listCpVideosApi(request, token);
      if (!existing[0]?.id) {
        throw new Error(
          `Wave 2 prerequisite missing: cannot create or list a video draft (${created.status} ${JSON.stringify(created.json)})`,
        );
      }
      created.json.id = existing[0].id;
      created.ok = true;
    }

    const videoId = String(created.json.id);
    const scenes = await putCpScenesApi(request, token, videoId, [
      {
        idx: 0,
        title: 'Locked UAT',
        overlay: LOCKED_OVERLAY,
        visual: 'Keep visual',
        vo: 'Keep VO',
        locked: true,
      },
    ]);
    expect(scenes.ok, `put scenes: ${scenes.status} ${JSON.stringify(scenes.json)}`).toBeTruthy();

    const regenerated = await regenerateCpSceneApi(request, token, videoId, 0);
    expect(
      regenerated.ok,
      `regenerate: ${regenerated.status} ${JSON.stringify(regenerated.json)}`,
    ).toBeTruthy();
    expect(regenerated.json.overlay).toBe(LOCKED_OVERLAY);
  });

  test('rights expiry blocks publish with 409', async ({ request }) => {
    const token = await staffToken(request);
    const version = await requireCpVersion(request, token);
    const assetIds = extractUsedAssetIds(version);
    if (assetIds.length === 0) {
      throw new Error(
        `Wave 2 prerequisite missing: version ${version.id} has no used assets to expire`,
      );
    }

    for (const assetId of assetIds) {
      const rights = await setCpAssetRightsApi(request, token, assetId, {
        expiry_on: expiredRightsDate(),
      });
      expect(
        rights.ok,
        `expire asset ${assetId}: ${rights.status} ${JSON.stringify(rights.json)}`,
      ).toBeTruthy();
    }

    const qc = await runCpQcApi(request, token, version.id, PASSING_QC_FACTS);
    expect(qc.ok, `QC pass before rights publish: ${qc.status} ${JSON.stringify(qc.json)}`).toBeTruthy();
    const approval = await submitCpApprovalApi(request, token, version.id, 'final_approved');
    expect(
      approval.ok,
      `set final_approved: ${approval.status} ${JSON.stringify(approval.json)}`,
    ).toBeTruthy();

    const scheduled = await scheduleCpPublishApi(request, token, {
      video_version_id: version.id,
      channel: 'tiktok',
    });
    expect(scheduled.status).toBe(409);
    expect(cpError(scheduled.json)).toBe('rights_blocked');
  });

  test('Creative OS pages have exactly one main', async ({ page }) => {
    await loginAsStaff(page);

    for (const href of CP_W2_NAV) {
      await page.goto(`${href}?scope=all`);
      await expect(page).not.toHaveURL(/\/(?:403|login)(?:\?|$)/);
      await expect(page.locator('main'), href).toHaveCount(1);
    }
  });
});
