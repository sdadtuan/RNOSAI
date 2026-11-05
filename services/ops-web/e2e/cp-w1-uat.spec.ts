import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  API_URL,
  CP_KPI_KEYS,
  createCpAssetApi,
  createCpProjectApi,
  fetchCpKpisApi,
  listCpVideosApi,
  renderCpVideoApi,
  staffToken,
  UNKNOWN_CLIENT,
} from './helpers/cp-w1-helpers';

test.describe('Creative Production OS W1 UAT', () => {
  test.beforeEach(async ({ request }) => {
    if (!(await apiReachable(request))) {
      throw new Error(`Wave 1 prerequisite missing: API is unreachable at ${API_URL}`);
    }
  });

  test('staff without crm_cp.view gets 403 or redirected from Creative OS', async ({ page }) => {
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
          caps: (user.caps ?? []).filter((cap) => cap.section !== 'crm_cp'),
        },
      });
    });

    await page.goto('/crm/creative-os');

    await expect(page).toHaveURL(/\/(?:403|login)(?:\?|$)/);
  });

  test('overview KPIs expose exactly 8 nullable numeric values and an ISO timestamp', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const body = await fetchCpKpisApi(request, token);

    expect(Object.keys(body.kpis).sort()).toEqual([...CP_KPI_KEYS].sort());
    for (const value of Object.values(body.kpis)) {
      expect(value === null || typeof value === 'number').toBeTruthy();
    }
    expect(body.last_updated).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(body.last_updated))).toBe(false);
  });

  test('project creation requires a client and rejects an unknown client', async ({ request }) => {
    const token = await staffToken(request);
    const common = {
      name: `CP-W1-UAT-${Date.now()}`,
      owner_staff_id: 1,
    };

    const missing = await createCpProjectApi(request, token, common);
    expect(missing.status).toBe(400);

    const unknown = await createCpProjectApi(request, token, {
      ...common,
      agency_client_id: UNKNOWN_CLIENT,
    });
    expect(unknown.status).toBe(400);
    expect(unknown.json.error).toBe('client_not_found');
  });

  test('asset creation rejects application/x-msdownload', async ({ request }) => {
    const token = await staffToken(request);
    const out = await createCpAssetApi(request, token, {
      agency_client_id: UNKNOWN_CLIENT,
      filename: 'wave-1-uat.exe',
      mime: 'application/x-msdownload',
    });

    expect(out.status).toBe(400);
    expect(out.json.error).toBe('mime_not_allowed');
  });

  test('replaying a render Idempotency-Key creates only one ledger reserve', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const videos = await listCpVideosApi(request, token);
    const draft = videos.find((video) => {
      const estimate = video.config_json?.estimated_credits;
      return typeof estimate === 'number' && estimate > 0;
    });
    if (!draft) {
      throw new Error(
        'Wave 1 prerequisite missing: no video draft with a positive credit estimate is available',
      );
    }

    const before = await fetchCpKpisApi(request, token, 'scope=all');
    const key = `cp-w1-uat-${crypto.randomUUID()}`;
    const first = await renderCpVideoApi(request, token, draft.id, key);
    if (first.status === 403 || first.status === 404 || first.status === 409) {
      throw new Error(
        `Wave 1 prerequisite missing: draft ${draft.id} cannot render (${first.status} ${JSON.stringify(first.json)})`,
      );
    }
    expect(first.ok, `first render: ${first.status} ${JSON.stringify(first.json)}`).toBeTruthy();
    expect(first.json.estimate).toEqual(expect.any(Number));

    const afterFirst = await fetchCpKpisApi(request, token, 'scope=all');
    const second = await renderCpVideoApi(request, token, draft.id, key);
    expect(second.ok, `replayed render: ${second.status} ${JSON.stringify(second.json)}`).toBeTruthy();
    const afterSecond = await fetchCpKpisApi(request, token, 'scope=all');

    expect(second.json.job_id ?? second.json.id).toBe(first.json.job_id ?? first.json.id);
    expect(afterSecond.kpis.credits_used).toBe(afterFirst.kpis.credits_used);
    expect((afterFirst.kpis.credits_used ?? 0) - (before.kpis.credits_used ?? 0)).toBe(
      first.json.estimate,
    );
  });

  test('empty overview has one main, 8 nav items, 8 KPI tiles, and no mock 3.840', async ({
    page,
  }) => {
    await loginAsStaff(page);
    await page.goto(`/crm/creative-os?scope=all&client=${UNKNOWN_CLIENT}`);

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Tổng quan sản xuất' })).toHaveCount(1);
    await expect(page.locator('.cp-sidebar__nav a')).toHaveCount(8);
    await expect(page.locator('.cp-kpi-tile')).toHaveCount(8);
    await expect(page.locator('main')).not.toContainText('3.840');
  });
});
