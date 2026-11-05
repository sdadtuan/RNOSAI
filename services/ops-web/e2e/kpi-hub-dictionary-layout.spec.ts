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
  display: flex;
  flex-direction: row;
  gap: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background: #fffdf8;
}
.kpi-hub-embed .kpi-hub-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 240px;
  width: 240px;
  max-width: 240px;
  background: #fff;
  border-right: 1px solid #e7e0d4;
  min-width: 0;
}
.kpi-hub-embed .kpi-hub-main {
  flex: 1 1 0%;
  min-width: 0;
  width: auto;
  background: #fffdf8;
}
.kpi-hub-embed .kpi-hub-page-with-drawer.kpi-hub-page-with-drawer--overlay.has-drawer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}
.kpi-hub-embed .kpi-hub-page-with-drawer--overlay.has-drawer .kpi-hub-page-with-drawer__main {
  width: auto;
  min-width: 0;
  overflow-x: hidden;
}
.kpi-hub-embed .kpi-hub-page-with-drawer--overlay .kpi-hub-dict-drawer {
  position: sticky;
  top: 0;
  width: auto;
  max-width: none;
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
        <aside class="kpi-hub-sidebar" style="width:240px">KPI Hub nav</aside>
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
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-shell\{[^}]*display:flex/);
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-main\{[^}]*flex:1 1/);
    expect(css).toMatch(/body:has\(\.kpi-hub-embed\) main\.bitrix-crm-page[,{][^}]*width:calc\(100vw - var\(--sidebar-width\)\)!important/);
    expect(css).not.toMatch(/\.kpi-hub-embed \.kpi-hub-sidebar\{[^}]*display:none!important/);
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-page-with-drawer\.kpi-hub-page-with-drawer--overlay\.has-drawer\{[^}]*display:grid/);
    expect(css).not.toMatch(/\.kpi-hub-embed \.kpi-hub-page-with-drawer--overlay \.kpi-hub-dict-drawer\{[^}]*position:fixed/);
    expect(css).not.toMatch(/padding-right:min\(380px,calc\(100vw/);
    expect(css).toMatch(/body:has\(\.kpi-hub-embed\)\{[^}]*overflow-x:hidden/);
    expect(css).toMatch(/body:has\(\.kpi-hub-embed\)\{[^}]*background:#fffdf8/);
    expect(css).toMatch(/\.kpi-hub-embed \.kpi-hub-freshness\{[^}]*margin-top:auto/);
    expect(css).toMatch(/body:has\(\.ops-sidebar\) \.kpi-hub-embed \.kpi-hub-content[,{][^}]*margin-left:0!important/);
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
    expect(mainBox!.width).toBeGreaterThan(shellBox!.width * 0.45);
    expect(drawerBox!.width).toBeGreaterThan(200);
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
    expect(mainBox!.width).toBeGreaterThan(shellBox!.width * 0.45);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width + 2);
    await expect(drawer.getByRole('heading', { level: 2, name: 'CPL Valid Lead' })).toBeVisible();
  });
});

function commandCenterFixture(title: string, extraRowClass = '') {
  return `
<aside class="ops-sidebar">Ops</aside>
<main class="ops-page ops-page--full bitrix-crm-page">
  <div class="bitrix-crm-page__inner">
    <div class="kpi-hub-embed">
      <div class="kpi-hub-shell">
        <aside class="kpi-hub-sidebar"><div style="padding:1rem">KPI Hub</div></aside>
        <div class="kpi-hub-main">
          <header class="kpi-hub-header">
            <div class="kpi-hub-header__left">
              <h1 class="kpi-hub-page-head__title">${title}</h1>
            </div>
            <div class="kpi-hub-header__right">
              <input class="kpi-hub-header__search" placeholder="Tìm trong Hub…" />
            </div>
          </header>
          <div class="kpi-hub-content">
            <div class="cc-page">
              <div class="cc-toolbar"><div class="cc-toolbar__filters">filters</div></div>
              <div class="cc-tiles">
                ${Array.from({ length: 6 }, () => '<article class="kpi-hub-card cc-tile">tile</article>').join('')}
              </div>
              <div class="cc-row cc-row--2"><article class="kpi-hub-card">left</article><article class="kpi-hub-card">right</article></div>
              <div class="cc-row cc-row--3${extraRowClass}"><article class="kpi-hub-card">a</article><article class="kpi-hub-card">b</article><article class="kpi-hub-card">c</article></div>
            </div>
          </div>
          <footer class="kpi-hub-freshness">
            <span class="kpi-hub-freshness__as-of">Dữ liệu cập nhật: Hôm nay, 08:45</span>
          </footer>
        </div>
      </div>
    </div>
  </div>
</main>`;
}

const MARKETING_FIXTURE_HTML = commandCenterFixture('Marketing Performance', ' cc-row--mkt-bottom');
const SALES_FIXTURE_HTML = commandCenterFixture('Sales Command Center');
const EXECUTIVE_FIXTURE_HTML = commandCenterFixture('Executive Command Center');
const DELIVERY_FIXTURE_HTML = `
<aside class="ops-sidebar">Ops</aside>
<main class="ops-page ops-page--full bitrix-crm-page">
  <div class="bitrix-crm-page__inner">
    <div class="kpi-hub-embed">
      <div class="kpi-hub-shell">
        <aside class="kpi-hub-sidebar"><div style="padding:1rem">KPI Hub</div></aside>
        <div class="kpi-hub-main">
          <header class="kpi-hub-header">
            <div class="kpi-hub-header__left"><h1 class="kpi-hub-page-head__title">Project Delivery</h1></div>
          </header>
          <div class="kpi-hub-content">
            <div class="delivery-page">
              <div class="delivery-tile-grid">
                <article class="delivery-tile">Tổng dự án</article>
                <article class="delivery-tile">Đúng tiến độ</article>
                <article class="delivery-tile">Có rủi ro</article>
                <article class="delivery-tile">Quá hạn</article>
                <article class="delivery-tile">Ngân sách</article>
                <article class="delivery-tile">Biên lợi nhuận</article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>`;

test.describe('KPI Hub command center layout fixture', () => {
  for (const { name, html } of [
    { name: 'Marketing', html: MARKETING_FIXTURE_HTML },
    { name: 'Sales', html: SALES_FIXTURE_HTML },
    { name: 'Executive', html: EXECUTIVE_FIXTURE_HTML },
    { name: 'Project Delivery', html: DELIVERY_FIXTURE_HTML },
  ]) {
    test(`${name} fills beside sidebar without cream gap or right clip`, async ({ page }) => {
      const cssFile = builtCssPath();
      test.skip(!cssFile, 'Run npm run build first');
      const css = fs.readFileSync(cssFile!, 'utf8');

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('about:blank');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        document.documentElement.classList.add('ops-shell-bitrix', 'ops-shell-expanded');
      });
      await page.addStyleTag({ content: css });

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const shell = page.locator('.kpi-hub-shell');
      const sidebar = page.locator('.kpi-hub-sidebar');
      const main = page.locator('.kpi-hub-main');
      const content = page.locator('.kpi-hub-content');

      const shellBox = await shell.boundingBox();
      const sidebarBox = await sidebar.boundingBox();
      const mainBox = await main.boundingBox();
      const contentBox = await content.boundingBox();

      expect(shellBox).not.toBeNull();
      expect(Math.abs(mainBox!.x - (shellBox!.x + sidebarBox!.width))).toBeLessThan(8);
      expect(mainBox!.width).toBeGreaterThan(shellBox!.width * 0.55);
      expect(Math.abs(contentBox!.x - mainBox!.x)).toBeLessThan(24);
      expect(mainBox!.x + mainBox!.width).toBeGreaterThan(shellBox!.x + shellBox!.width - 8);
      expect(mainBox!.x + mainBox!.width).toBeLessThanOrEqual(1440 + 1);
      expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(1440 + 1);

      const lastTile = page.locator('.delivery-tile').last();
      if (await lastTile.count()) {
        const tileBox = await lastTile.boundingBox();
        expect(tileBox!.x + tileBox!.width).toBeLessThanOrEqual(1440 + 1);
      }

      const freshness = page.locator('.kpi-hub-freshness');
      if (await freshness.count()) {
        const freshnessBox = await freshness.boundingBox();
        expect(freshnessBox!.x + freshnessBox!.width).toBeLessThanOrEqual(1440 + 1);
        expect(freshnessBox!.width).toBeGreaterThan(mainBox!.width * 0.95);
      }
    });
  }
});
