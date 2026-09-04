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

/** Minimal rules under test — mirrors globals.css layout contract */
const LAYOUT_CSS = `
.kpi-hub-shell {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  width: 100%;
  background: #f3efe6;
}
.kpi-hub-embed .kpi-hub-sidebar {
  display: flex;
  flex-direction: column;
  background: #fff;
}
.kpi-hub-page-with-drawer--overlay.has-drawer {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
}
.kpi-hub-page-with-drawer--overlay.has-drawer .kpi-hub-page-with-drawer__main {
  flex: 1 1 520px;
  min-width: 0;
}
.kpi-hub-page-with-drawer--overlay .kpi-hub-dict-drawer {
  flex: 1 1 280px;
  min-width: min(100%, 280px);
  max-width: min(100%, 360px);
}
@media (max-width: 900px) {
  .kpi-hub-embed .kpi-hub-shell,
  .kpi-hub-embed .kpi-hub-shell--collapsed {
    grid-template-columns: 64px minmax(0, 1fr);
  }
  .kpi-hub-embed .kpi-hub-sidebar__brand strong,
  .kpi-hub-embed .kpi-hub-sidebar__link > span:not(.kpi-hub-sidebar__icon) {
    display: none;
  }
}
@media (max-width: 1100px) {
  .kpi-hub-page-with-drawer--overlay.has-drawer .kpi-hub-page-with-drawer__main {
    flex: 1 1 100%;
  }
  .kpi-hub-page-with-drawer--overlay .kpi-hub-dict-drawer {
    flex: 1 1 100%;
    max-width: 100%;
    min-width: 0;
  }
}
`;

const FIXTURE_HTML = `
<main class="ops-page ops-page--full bitrix-crm-page">
  <div class="bitrix-crm-page__inner">
    <div class="kpi-hub-embed">
      <div class="kpi-hub-shell">
        <aside class="kpi-hub-sidebar">
          <div class="kpi-hub-sidebar__brand">
            <span class="kpi-hub-sidebar__logo">📊</span>
            <strong>KPI Hub</strong>
          </div>
          <nav class="kpi-hub-sidebar__nav">
            <a class="kpi-hub-sidebar__link is-active" href="#"><span class="kpi-hub-sidebar__icon">▣</span><span>KPI Dictionary</span></a>
          </nav>
        </aside>
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
  test('production bundle avoids pinned 200px embed shell column', () => {
    const cssFile = builtCssPath();
    test.skip(!cssFile, 'Run npm run build first');
    const css = fs.readFileSync(cssFile!, 'utf8');
    expect(css).not.toMatch(/\.kpi-hub-embed \.kpi-hub-shell\{[^}]*grid-template-columns:200px/);
    expect(css).toContain('.kpi-hub-page-with-drawer--overlay.has-drawer{display:flex');
    expect(css).toContain('grid-template-columns:64px minmax(0,1fr)');
  });
});

test.describe('KPI Dictionary layout (live)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.OPS_E2E_SKIP_SERVER === '1', 'Live layout test needs running ops-web server');
    await loginOrSkip(page);
  });

  test('sidebar flush with shell and drawer fully visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/crm/kpi-hub/dictionary');
    await expect(page.getByRole('heading', { level: 1, name: 'KPI Dictionary' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { level: 2, name: 'CPL Valid Lead' })).toBeVisible({
      timeout: 20_000,
    });

    const shell = page.locator('.kpi-hub-embed .kpi-hub-shell');
    const sidebar = page.locator('.kpi-hub-embed .kpi-hub-sidebar');
    const drawer = page.locator('.kpi-hub-dict-drawer');

    const shellBox = await shell.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    const drawerBox = await drawer.boundingBox();

    expect(shellBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    expect(Math.abs(sidebarBox!.x - shellBox!.x)).toBeLessThan(2);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width + 2);
  });
});

test.describe('KPI Dictionary layout fixture', () => {
  test('layout rules keep sidebar flush and drawer inside shell', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto('about:blank');
    await page.setContent(FIXTURE_HTML, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: LAYOUT_CSS });

    const shell = page.locator('.kpi-hub-shell');
    const sidebar = page.locator('.kpi-hub-sidebar');
    const drawer = page.locator('.kpi-hub-dict-drawer');

    const shellBox = await shell.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    const drawerBox = await drawer.boundingBox();

    expect(Math.abs(sidebarBox!.x - shellBox!.x)).toBeLessThan(2);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width + 2);
    await expect(drawer.getByRole('heading', { level: 2, name: 'CPL Valid Lead' })).toBeVisible();
  });

  test('layout rules use 64px rail below 900px without empty gap', async ({ page }) => {
    await page.setViewportSize({ width: 860, height: 720 });
    await page.goto('about:blank');
    await page.setContent(FIXTURE_HTML, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: LAYOUT_CSS });

    const sidebar = page.locator('.kpi-hub-sidebar');
    const drawer = page.locator('.kpi-hub-dict-drawer');
    const main = page.locator('.kpi-hub-page-with-drawer__main');
    const shell = page.locator('.kpi-hub-shell');

    const sidebarBox = await sidebar.boundingBox();
    const drawerBox = await drawer.boundingBox();
    const mainBox = await main.boundingBox();
    const shellBox = await shell.boundingBox();

    expect(sidebarBox!.width).toBeLessThan(100);
    expect(drawerBox!.y).toBeGreaterThanOrEqual(mainBox!.y + mainBox!.height - 4);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width + 2);
  });
});
