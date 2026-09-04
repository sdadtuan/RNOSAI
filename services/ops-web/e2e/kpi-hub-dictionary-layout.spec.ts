import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { STAFF_EMAIL, STAFF_PASSWORD } from './helpers/ai-copilot-helpers';

const CSS_DIR = path.join(__dirname, '../.next/static/css');

function builtCssPath(): string | null {
  if (!fs.existsSync(CSS_DIR)) return null;
  const file = fs
    .readdirSync(CSS_DIR)
    .find((f) => f.endsWith('.css') && fs.statSync(path.join(CSS_DIR, f)).size > 100_000);
  return file ? path.join(CSS_DIR, file) : null;
}

const LAYOUT_CSS = `
.kpi-hub-embed { width: 100%; max-width: 100%; overflow-x: clip; }
.kpi-hub-embed .kpi-hub-shell {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.kpi-hub-embed .kpi-hub-sidebar {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e7e0d4;
  min-width: 0;
}
.kpi-hub-embed .kpi-hub-page-with-drawer.kpi-hub-page-with-drawer--overlay.has-drawer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}
.kpi-hub-embed .kpi-hub-page-with-drawer--overlay.has-drawer .kpi-hub-page-with-drawer__main {
  min-width: 0;
  overflow-x: hidden;
}
.kpi-hub-embed .kpi-hub-page-with-drawer--overlay .kpi-hub-dict-drawer {
  position: sticky;
  top: 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
@media (max-width: 1100px) {
  .kpi-hub-embed .kpi-hub-page-with-drawer.kpi-hub-page-with-drawer--overlay.has-drawer {
    display: flex;
    flex-wrap: wrap;
  }
}
`;

const FIXTURE_HTML = `
<main class="ops-page ops-page--full bitrix-crm-page">
  <div class="bitrix-crm-page__inner">
    <div class="kpi-hub-embed">
      <div class="kpi-hub-shell">
        <aside class="kpi-hub-sidebar" style="width:200px">KPI Hub nav</aside>
        <div class="kpi-hub-main">
          <div class="kpi-hub-content">
            <div class="kpi-hub-page-with-drawer kpi-hub-page-with-drawer--overlay has-drawer">
              <div class="kpi-hub-page-with-drawer__main">
                <div class="kpi-hub-dict-table">
                  <div class="kpi-hub-table-wrap">
                    <table class="kpi-hub-table"><tbody><tr class="is-selected"><td>MKT_006</td><td>CPL Valid Lead</td></tr></tbody></table>
                  </div>
                </div>
              </div>
              <aside class="kpi-hub-drawer kpi-hub-dict-drawer">
                <header class="kpi-hub-dict-drawer__head"><div class="kpi-hub-dict-drawer__title-row"><h2>CPL Valid Lead</h2></div></header>
                <div class="kpi-hub-drawer__body kpi-hub-dict-drawer__body"><p class="kpi-hub-dict-drawer__text">Chi phí trên mỗi Valid Lead từ các kênh quảng cáo trả phí.</p></div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>`;

async function loginOrSkip(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#email').fill(STAFF_EMAIL);
  await page.locator('#password').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  } catch {
    test.skip(true, 'Staff login failed — set OPS_E2E_STAFF_EMAIL / OPS_E2E_STAFF_PASSWORD');
  }
}

test.describe('KPI Dictionary built CSS contract', () => {
  test('embed uses three-column grid without 100vw overflow', () => {
    const cssFile = builtCssPath();
    test.skip(!cssFile, 'Run npm run build first');
    const css = fs.readFileSync(cssFile!, 'utf8');
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-shell\{[^}]*display:grid/);
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-shell\{[^}]*grid-template-columns:200px minmax\(0,1fr\)/);
    expect(css).not.toMatch(/\.kpi-hub-embed \.kpi-hub-sidebar\{[^}]*display:none!important/);
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-page-with-drawer\.kpi-hub-page-with-drawer--overlay\.has-drawer\{[^}]*display:grid/);
    expect(css).not.toMatch(/\.kpi-hub-embed \.kpi-hub-page-with-drawer--overlay \.kpi-hub-dict-drawer\{[^}]*position:fixed/);
    expect(css).not.toMatch(/padding-right:min\(380px,calc\(100vw/);
    expect(css).toMatch(/body:has\(\.kpi-hub-embed\)\{[^}]*overflow-x:hidden/);
  });
});

test.describe('KPI Dictionary layout (live)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.OPS_E2E_SKIP_SERVER === '1', 'Live layout test needs running ops-web server');
    await loginOrSkip(page);
  });

  test('inner sidebar visible, drawer fully inside viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/crm/kpi-hub/dictionary');
    await expect(page.getByRole('heading', { level: 2, name: 'CPL Valid Lead' })).toBeVisible({
      timeout: 20_000,
    });

    const shell = page.locator('.kpi-hub-embed .kpi-hub-shell');
    const sidebar = page.locator('.kpi-hub-embed .kpi-hub-sidebar');
    const main = page.locator('.kpi-hub-embed .kpi-hub-main');
    const drawer = page.locator('.kpi-hub-dict-drawer');

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('KPI Dictionary')).toBeVisible();

    const shellBox = await shell.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    const mainBox = await main.boundingBox();
    const drawerBox = await drawer.boundingBox();

    expect(shellBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    expect(sidebarBox!.width).toBeGreaterThan(150);
    expect(Math.abs(mainBox!.x - (shellBox!.x + sidebarBox!.width))).toBeLessThan(8);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(1280);
    await expect(drawer.getByText('Chi phí trên mỗi Valid Lead', { exact: false })).toBeVisible();
  });
});

test.describe('KPI Dictionary layout fixture', () => {
  test('three-column shell and drawer stay inside viewport without page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('about:blank');
    await page.setContent(FIXTURE_HTML, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: LAYOUT_CSS });

    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalScroll).toBe(false);

    const shell = page.locator('.kpi-hub-shell');
    const sidebar = page.locator('.kpi-hub-sidebar');
    const main = page.locator('.kpi-hub-main');
    const drawer = page.locator('.kpi-hub-dict-drawer');

    await expect(sidebar).toBeVisible();

    const shellBox = await shell.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    const mainBox = await main.boundingBox();
    const drawerBox = await drawer.boundingBox();

    expect(sidebarBox!.width).toBeGreaterThan(150);
    expect(Math.abs(mainBox!.x - (shellBox!.x + sidebarBox!.width))).toBeLessThan(8);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width + 2);
    await expect(drawer.getByRole('heading', { level: 2, name: 'CPL Valid Lead' })).toBeVisible();
  });
});
