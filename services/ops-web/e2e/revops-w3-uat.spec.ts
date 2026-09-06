import { expect, test } from '@playwright/test';
import { apiReachable, API_URL, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  calcCommissionVnd,
  createCommissionTransactionApi,
  fetchRevopsCommandCenterApi,
  fetchRevopsCommissionHubApi,
  fetchRevopsSlaCenterApi,
  fetchRevopsTerritoryCenterApi,
  simulateRevopsRoutingApi,
  staffToken,
} from './helpers/revops-w3-helpers';

test.describe('RevOps W3 UAT', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'API down');
    test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  });

  test('commission hub exposes KPI weights 45/25/15/15', async ({ request }) => {
    const token = await staffToken(request);
    const hub = await fetchRevopsCommissionHubApi(request, token);
    expect(hub.weights.newPct).toBe(45);
    expect(hub.weights.renewalPct).toBe(25);
    expect(hub.weights.upsellPct).toBe(15);
    expect(hub.weights.slaPct).toBe(15);
    expect(hub.summary).toHaveProperty('estimatedVnd');
  });

  test('commission transaction matches calcCommissionVnd when manage cap', async ({ request }) => {
    const token = await staffToken(request);
    const eligible = 10_000_000;
    const rate = 5;
    const split = 100;
    const expected = calcCommissionVnd(eligible, rate, split);

    const probe = await request.post(`${API_URL}/api/crm/revops/commission/transactions`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        deal_ref: `W3-UAT-probe-${Date.now()}`,
        staff_id: 1,
        eligible_vnd: eligible,
        rate_pct: rate,
        split_pct: split,
      },
    });

    if (probe.status() === 403) {
      test.skip(true, 'No crm_revops.commission manage cap — calc covered by unit tests');
    }

    const tx = await createCommissionTransactionApi(request, token, {
      deal_ref: `W3-UAT-${Date.now()}`,
      staff_id: 1,
      eligible_vnd: eligible,
      rate_pct: rate,
      split_pct: split,
    });
    expect(tx.commissionVnd).toBe(expected);
  });

  test('command center commission block is wired', async ({ request }) => {
    const token = await staffToken(request);
    const cc = await fetchRevopsCommandCenterApi(request, token);
    expect(cc.commission).toBeDefined();
    expect(cc.commission).toHaveProperty('estimatedVnd');
    expect(cc.commission).toHaveProperty('approvedVnd');
    expect(cc.commission).toHaveProperty('pendingVnd');
  });

  test('SLA center API returns compliance target and incidents', async ({ request }) => {
    const token = await staffToken(request);
    const sla = await fetchRevopsSlaCenterApi(request, token);
    expect(sla.kpis.complianceTargetPct).toBe(95);
    expect(Array.isArray(sla.incidents)).toBeTruthy();
  });

  test('territory center seeds routing rules and simulate returns ranked owners shape', async ({
    request,
  }) => {
    const token = await staffToken(request);
    const territory = await fetchRevopsTerritoryCenterApi(request, token);
    expect(territory.kpis.activeTerritories).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(territory.rules)).toBeTruthy();

    const sim = await simulateRevopsRoutingApi(request, token);
    expect(Array.isArray(sim.rankedOwners)).toBeTruthy();
    if (sim.rankedOwners.length > 0) {
      expect(sim.rankedOwners[0]).toHaveProperty('staffId');
      expect(sim.rankedOwners[0]).toHaveProperty('score');
    }
  });

  test('SLA page loads in RevOps shell', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops/sla');
    await expect(page.getByRole('heading', { name: /SLA & Escalation/i })).toBeVisible();
    await expect(page.getByText(/Compliance/i)).toBeVisible();
  });

  test('Territory page loads with simulate section', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops/territory');
    await expect(page.getByRole('heading', { name: /Territory & Capacity/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Simulate routing/i })).toBeVisible();
  });

  test('KPI Hub embed shows commission panel when revops=1', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/kpi-hub/sales?revops=1');
    await expect(page.getByTestId('sales-commission-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Hoa hồng & Payout/i)).toBeVisible();
  });

  test('Command Center shows commission plan/payout actions', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');
    await expect(page.getByRole('heading', { name: /Command Center/i })).toBeVisible();
    await expect(page.getByText(/Hoa hồng tạm tính/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payout' })).toBeVisible();
  });
});
