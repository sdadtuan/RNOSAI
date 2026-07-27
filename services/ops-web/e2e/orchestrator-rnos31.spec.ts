import { test, expect } from '@playwright/test';
import {
  API_URL,
  apiReachable,
  loginAsStaff,
  staffToken,
} from './helpers/ai-copilot-helpers';

async function resolveLeadFixture(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<number | null> {
  const configured = Number(process.env.OPS_E2E_AI_LEAD_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;

  const response = await request.get(`${API_URL}/api/v1/leads?limit=1&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) return null;
  const body = (await response.json()) as {
    leads?: Array<{ id?: number }>;
    data?: { leads?: Array<{ id?: number }> };
  };
  const id = body.leads?.[0]?.id ?? body.data?.leads?.[0]?.id;
  return Number.isInteger(id) && Number(id) > 0 ? Number(id) : null;
}

test.describe('RNOS-31 Multi-agent orchestrator', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('admin triggers lead_intake_v1 and views its trace tree', async ({ page, request }) => {
    const token = await staffToken(request);
    const leadId = await resolveLeadFixture(request, token);
    test.skip(!leadId, 'No lead fixture available for orchestrator E2E');

    const runResponse = await request.post(`${API_URL}/api/v1/ai/orchestrator/run`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        planKey: 'lead_intake_v1',
        input: {
          entityType: 'lead',
          entityId: String(leadId),
          leadId,
        },
      },
    });
    if (runResponse.status() === 503) {
      test.skip(true, 'Orchestrator flag or RNOS-31 schema not ready');
    }
    expect(
      runResponse.ok(),
      `orchestrator/run: ${runResponse.status()} ${await runResponse.text()}`,
    ).toBeTruthy();

    const run = (await runResponse.json()) as {
      data?: {
        orchestration_id?: string;
        plan_key?: string;
        steps?: Array<{ stepKey?: string; status?: string }>;
      };
    };
    expect(run.data?.plan_key).toBe('lead_intake_v1');
    expect(run.data?.orchestration_id).toBeTruthy();
    expect(run.data?.steps?.some((step) => step.stepKey === 'score_lead')).toBeTruthy();

    const orchestrationId = run.data!.orchestration_id!;
    await page.goto(`/admin/ai/agents?id=${encodeURIComponent(orchestrationId)}`);

    await expect(page.getByRole('heading', { level: 2, name: /Multi-agent traces/i })).toBeVisible();
    await expect(page.getByText(orchestrationId, { exact: true })).toBeVisible();
    const tree = page.getByRole('tree', { name: 'Orchestration agent runs' });
    await expect(tree).toBeVisible();
    await expect(tree.getByText('orchestrator', { exact: true })).toBeVisible();
    await expect(tree.getByText('score_lead', { exact: true })).toBeVisible();
  });
});
