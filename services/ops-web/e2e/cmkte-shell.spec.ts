import { test, expect, type Page } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';
import { CMKTE_TABS } from '../src/lib/crm/cmkte-tabs';

const EMPTY_COMMAND_CENTER = {
  throughput_week: 0,
  completed_week: 0,
  wip: 0,
  sla_at_risk: 0,
  sla_breached: 0,
  first_pass_pct: null,
  capacity_pct: null,
  blocked: 0,
  risk_queue: [],
};

const TRIAL_ITEM = {
  id: 1,
  lifecycle_id: 1,
  idea_id: null,
  title: 'Item thử',
  format: 'social_post',
  channel: 'facebook',
  funnel_goal: '',
  status: 'draft',
  brief_json: {},
  body_json: {},
  selected_variant_idx: null,
  created_by: '',
  created_at: '',
  updated_at: '',
};

async function mockCommandCenter(page: Page): Promise<void> {
  await page.route('**/api/crm/content-os/portfolio/command-center**', async (route) => {
    await route.fulfill({ json: EMPTY_COMMAND_CENTER });
  });
}

async function mockPortfolioItem(page: Page): Promise<void> {
  await page.route('**/portfolio/items/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: TRIAL_ITEM });
  });
}

async function expandOpsNav(page: Page): Promise<void> {
  const expand = page.getByRole('button', { name: /Mở rộng menu|»/ }).first();
  if (await expand.isVisible()) {
    await expand.click();
  }
  const delivery = page.getByRole('button', { name: /Triển khai dịch vụ/ });
  if (await delivery.isVisible()) {
    const expanded = await delivery.getAttribute('aria-expanded');
    if (expanded === 'false') {
      await delivery.click();
    }
  }
}

test.describe('CMKT-E COS shell', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await mockCommandCenter(page);
    await loginAsStaff(page);
  });

  test('flag and cap show Content Marketing OS nav', async ({ page }) => {
    await page.goto('/crm');
    await expandOpsNav(page);
    await expect(page.locator('.ops-sidebar').getByText('Content Marketing OS', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('command center heading', async ({ page }) => {
    await page.goto('/crm/content-os');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Content Operations Command Center' }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('create item opens request dialog', async ({ page }) => {
    await page.goto('/crm/content-os');
    await page.getByRole('button', { name: /Tạo Content Item/ }).click();
    await expect(page.getByRole('heading', { name: 'Tạo Content Request' })).toBeVisible();
  });

  test('submit missing fields stays on request dialog', async ({ page }) => {
    await page.goto('/crm/content-os');
    await page.getByRole('button', { name: /Tạo Content Item/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Tạo và mở triage/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tạo Content Request' })).toBeVisible();
  });

  test('workspace shows eight tab names', async ({ page }) => {
    await mockPortfolioItem(page);
    await page.goto('/crm/content-os/w/1');
    await expect(page.getByRole('heading', { name: /Content Production Workspace/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Item thử')).toBeVisible();
    await expect(page.getByText(/Sunlight|Nova/)).toHaveCount(0);
    for (const tab of CMKTE_TABS) {
      await expect(page.getByRole('tab', { name: tab.label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('tab')).toHaveCount(CMKTE_TABS.length);
  });

  test('save and validate blocks when gate flags missing', async ({ page }) => {
    await mockPortfolioItem(page);
    await page.goto('/crm/content-os/w/1');
    await expect(page.getByRole('heading', { name: /Content Production Workspace/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Save & validate' }).click();
    await expect(page.getByText(/BLOCKED/)).toBeVisible();
  });
});
