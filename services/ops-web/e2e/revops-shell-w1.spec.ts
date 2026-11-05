import { expect, test } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test('sidebar Command Center active', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops');
  await expect(page.getByRole('navigation').getByText('Command Center')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales & Account Command Center' })).toBeVisible();
});

test('RevOps nav Leads link uses embed mode', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops');
  await page
    .getByRole('navigation', { name: 'Revenue Operations' })
    .getByRole('link', { name: 'Leads & Routing' })
    .click();
  await expect(page).toHaveURL(/\/crm\/leads\?revops=1/);
  await expect(page.locator('html')).toHaveClass(/revops-embed/);
});

test('embed mode hides KPI Hub inner sidebar', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/kpi-hub/sales?revops=1');
  await expect(page.locator('html')).toHaveClass(/revops-embed/);
  await expect(page.locator('.kpi-hub-sidebar')).toBeHidden();
});

test('pipeline kanban renders 5 stage columns', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops/pipeline');
  await expect(page.getByRole('heading', { name: 'Pipeline & Deal Management' })).toBeVisible();
  const kanban = page.getByTestId('revops-pipeline-kanban');
  await expect(kanban).toBeVisible();
  await expect(kanban.locator('.revops-kanban-col')).toHaveCount(5);
  await expect(kanban.getByRole('heading', { name: 'Discovery' })).toBeVisible();
  await expect(kanban.getByRole('heading', { name: 'Qualified' })).toBeVisible();
  await expect(kanban.getByRole('heading', { name: 'Proposal' })).toBeVisible();
  await expect(kanban.getByRole('heading', { name: 'Negotiation' })).toBeVisible();
  await expect(kanban.getByRole('heading', { name: 'Contract Review' })).toBeVisible();
});

test('approvals center renders KPI row and discount matrix', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops/approvals');
  await expect(page.getByRole('heading', { name: 'Approval Center' })).toBeVisible();
  await expect(page.getByTestId('revops-approvals-queue')).toBeVisible();
  await expect(page.getByTestId('revops-discount-matrix')).toBeVisible();
  await expect(page.getByText('Waiting for me')).toBeVisible();
  await expect(page.getByText('≤5%')).toBeVisible();
});

test('handover alias redirects to AM onboarding embed', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  await loginAsStaff(page);
  await page.goto('/crm/leads/handover?revops=1');
  await expect(page).toHaveURL(/\/crm\/account-management\/onboarding\?revops=1/);
});

test('leads inbox revops embed shows P1 view and footer', async ({ page, request }) => {
  test.skip(!(await apiReachable(request)), 'API down');
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/leads?revops=1');
  await expect(page.locator('html')).toHaveClass(/revops-embed/);
  await expect(page.getByRole('columnheader', { name: 'ICP / Score' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lead P1' })).toBeVisible();
  await page.getByRole('button', { name: 'Lead P1' }).click();
  await expect(page).toHaveURL(/view=p1/);
  await expect(page.getByText('Lead P1')).toBeVisible();
  await expect(page.getByTestId('leads-revops-footer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Routing waterfall' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SLA escalation timeline' })).toBeVisible();
});
