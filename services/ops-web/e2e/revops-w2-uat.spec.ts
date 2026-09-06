import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  expectRequiredFieldMarkers,
  fetchAmAccountsApi,
  fetchRevopsApprovalsApi,
  fetchRevopsPipelineApi,
  fetchStaffRosterApi,
  openRevopsQuickCreateTile,
  staffToken,
} from './helpers/revops-w2-helpers';

test.describe('RevOps W2 UAT', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'API down');
    test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  });

  test('pipeline kanban card opens deal-room', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await staffToken(request);
    const pipeline = await fetchRevopsPipelineApi(request, token);
    const firstCard = pipeline.columns.flatMap((col) => col.cards)[0];

    await page.goto('/crm/revenue-ops/pipeline');
    await expect(page.getByTestId('revops-pipeline-kanban')).toBeVisible();

    if (firstCard) {
      await page.getByTestId(`pipeline-card-${firstCard.leadId}`).click();
      await expect(page).toHaveURL(new RegExp(`/crm/leads/${firstCard.leadId}/deal-room`));
      return;
    }

    test.info().annotations.push({
      type: 'note',
      description: 'No pipeline cards in API — verified kanban shell only',
    });
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible();
  });

  test('approval modal validates comment before approve', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await staffToken(request);
    const approvals = await fetchRevopsApprovalsApi(request, token);
    test.skip(approvals.queue.length === 0, 'No approval queue items');

    await page.goto('/crm/revenue-ops/approvals');
    await page.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review Approval' })).toBeVisible();

    await page.getByRole('button', { name: 'Duyệt' }).click();
    await expect(page.getByRole('status')).toContainText('Comment là bắt buộc');
  });

  test('approval KPI approve e2e when actionable item exists', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await staffToken(request);
    const approvals = await fetchRevopsApprovalsApi(request, token);
    const item = approvals.queue.find((row) => row.canAct);
    test.skip(!item, 'No actionable KPI approval in queue');

    await page.goto('/crm/revenue-ops/approvals');
    const row = page.getByRole('row').filter({ hasText: item!.title }).first();
    await row.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const comment = `W2 UAT approve ${Date.now()}`;
    await page.getByPlaceholder('Ghi chú phê duyệt…').fill(comment);
    await page.getByRole('button', { name: 'Duyệt' }).click();
    await expect(page.getByRole('status')).toContainText('Đã duyệt', { timeout: 15_000 });
  });

  test('W2 modals show required field markers', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');

    await openRevopsQuickCreateTile(page, /Handover/);
    await expect(page.getByRole('heading', { name: 'Sales Handover Package' })).toBeVisible();
    await expectRequiredFieldMarkers(page, 5);
    await page.getByRole('button', { name: 'Hủy' }).click();

    await openRevopsQuickCreateTile(page, /Account mới/);
    await expect(page.getByRole('heading', { name: 'Tạo Account' })).toBeVisible();
    await expectRequiredFieldMarkers(page, 2);
    await page.getByRole('button', { name: 'Hủy' }).click();

    await openRevopsQuickCreateTile(page, /Giao KPI/);
    await expect(page.getByRole('heading', { name: 'Giao KPI' })).toBeVisible();
    await expectRequiredFieldMarkers(page, 4);
  });

  test('handover modal validates required fields on submit', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/crm/revenue-ops');
    await openRevopsQuickCreateTile(page, /Handover/);
    await page.getByRole('button', { name: 'Tạo handover' }).click();
    await expect(page.getByRole('status')).toContainText('bắt buộc');
  });

  test('handover modal creates record visible in AM onboarding', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await staffToken(request);
    const [accounts, staff] = await Promise.all([
      fetchAmAccountsApi(request, token),
      fetchStaffRosterApi(request, token),
    ]);
    test.skip(accounts.length === 0, 'No AM accounts');
    test.skip(staff.length === 0, 'No staff roster');

    const account = accounts[0]!;
    const ae = staff[0]!;
    const goals = `W2 UAT goals ${Date.now()}`;
    const scope = `W2 UAT exclusions ${Date.now()}`;
    const kickoff = '2026-09-15';

    await page.goto('/crm/revenue-ops');
    await openRevopsQuickCreateTile(page, /Handover/);

    await page.locator('#revops-handover-form select').nth(0).selectOption(account.agency_client_id);
    await page.locator('#revops-handover-form select').nth(1).selectOption(String(ae.id));
    await page.locator('#revops-handover-form input[type="date"]').fill(kickoff);
    await page.locator('#revops-handover-form textarea').nth(0).fill(goals);
    await page.locator('#revops-handover-form textarea').nth(1).fill(scope);

    await page.getByRole('button', { name: 'Tạo handover' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/crm/account-management/onboarding\\?revops=1&agency_client_id=${account.agency_client_id}`),
      { timeout: 20_000 },
    );
    await expect(page.getByRole('heading', { name: 'Hàng chờ handover' })).toBeVisible();
    await expect(page.getByRole('button', { name: account.name }).or(page.getByText(account.name))).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Mở handover' }).first()).toBeVisible();
  });
});
