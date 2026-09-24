# CSD Chat App (PWA) và Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa Chat SD ra PWA điện thoại và cửa sổ Desktop, dùng nguyên UI/API chat hiện có.

**Architecture:** ops-web thêm vỏ `crm | pwa | desktop`. PWA là manifest riêng + ẩn menu CRM khi mở từ màn hình chính. Desktop là Electron tải `https://rs.pttads.vn/crm/csd/chat?shell=desktop` và chỉ thêm cầu file khi `window.rnosDesktop` có mặt. Không sửa `ptt-crm-api`. Không đè manifest lead `/manifest.webmanifest`.

**Tech Stack:** Next.js ops-web, Vitest, Electron 33, electron-builder, contextBridge.

**Spec:** `docs/superpowers/specs/2026-09-24-csd-chat-app-desktop-design.md`

## Global Constraints

- Không viết lại API chat, không WebSocket, không app store.
- Không Zalo OA / Messenger / Slack / email khách.
- Không form đăng ký, không đổi mật khẩu staff.
- Admin `/admin/crm/csd/chat-accounts` chỉ trên web CRM.
- Gọi thoại/video chỉ `kind === 'direct'`. Không gọi nhóm.
- Không link mời công khai, không QR, không ghim nhiều tin.
- Không bịa tin, ticket, số KPI.
- Quyền giữ ma trận 2026-09-16. `csd.view` để xem, `csd.write` để gửi, `csd.manage` hoặc `csd.admin` bypass vai trò nhóm.
- Manifest CRM lead (`src/app/manifest.ts`, `start_url: '/crm/leads'`) giữ nguyên.
- Web không có `window.rnosDesktop` giữ mở file bằng tab / IndexedDB.
- Khi app điện thoại bị hệ điều hành ngủ, không hứa tin realtime.
- Dock đã ẩn trên `/crm/csd/chat`. Việc mới là ẩn `OpsNav` và chrome CRM trong vỏ PWA/Desktop.

## File map

| File | Việc |
|------|------|
| `services/ops-web/src/lib/crm/csd-chat-shell.ts` | Đọc vỏ từ query, `display-mode`, iOS standalone |
| `services/ops-web/src/lib/auth/login-next.util.ts` | `/login?next=` giữ path + query |
| `services/ops-web/public/csd-chat-manifest.webmanifest` | Tên “Chat SD”, `start_url` chat |
| `services/ops-web/src/app/crm/csd/chat/layout.tsx` | Gắn manifest chỉ trang chat |
| `services/ops-web/src/middleware.ts` | Cho phép tải manifest không cần cookie |
| `services/ops-web/src/components/layout/StaffPageShell.tsx` | Prop `chrome` |
| `services/ops-web/src/app/crm/csd/chat/page.tsx` | Bật vỏ, dòng chú thích ngủ máy |
| `services/ops-web/src/components/crm/csd/CsdChatContext.tsx` | Ticket mở tab mới khi không phải CRM |
| `services/ops-web/src/lib/crm/csd-chat-desktop-bridge.ts` | Type + gọi `window.rnosDesktop` |
| `services/ops-web/src/lib/crm/csd-chat-file-local.ts` | Ưu tiên cầu file nếu có |
| `services/ops-desktop/` | Cửa sổ, khay, preload |

---

### Task 1: Nhận diện vỏ chat

**Files:**
- Create: `services/ops-web/src/lib/crm/csd-chat-shell.ts`
- Test: `services/ops-web/src/lib/crm/csd-chat-shell.spec.ts`

**Interfaces:**
- Consumes: `location.search`, `matchMedia('(display-mode: standalone)')`, `navigator.standalone` trên iOS
- Produces: `detectCsdChatShell(input): 'crm' | 'pwa' | 'desktop'` và `readCsdChatShell(): 'crm' | 'pwa' | 'desktop'`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { detectCsdChatShell } from './csd-chat-shell';

describe('detectCsdChatShell', () => {
  it('keeps the CRM chrome on a normal chat URL', () => {
    expect(detectCsdChatShell({ search: '' })).toBe('crm');
  });

  it('treats shell=desktop as the desktop window', () => {
    expect(detectCsdChatShell({ search: '?shell=desktop&c=abc' })).toBe('desktop');
  });

  it('treats an installed home-screen launch as the phone PWA', () => {
    expect(detectCsdChatShell({ search: '', displayMode: 'standalone' })).toBe('pwa');
    expect(detectCsdChatShell({ search: '', iosStandalone: true })).toBe('pwa');
    expect(detectCsdChatShell({ search: '?shell=pwa' })).toBe('pwa');
  });

  it('lets an explicit desktop query win over standalone', () => {
    expect(detectCsdChatShell({ search: '?shell=desktop', displayMode: 'standalone' })).toBe('desktop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts`

Expected: FAIL, cannot find module `./csd-chat-shell`

- [ ] **Step 3: Write minimal implementation**

```ts
export type CsdChatShell = 'crm' | 'pwa' | 'desktop';

export function detectCsdChatShell(input: {
  search: string;
  displayMode?: string;
  iosStandalone?: boolean;
}): CsdChatShell {
  const shell = new URLSearchParams(input.search).get('shell');
  if (shell === 'desktop') return 'desktop';
  if (shell === 'pwa' || input.displayMode === 'standalone' || input.iosStandalone === true) {
    return 'pwa';
  }
  return 'crm';
}

export function readCsdChatShell(): CsdChatShell {
  if (typeof window === 'undefined') return 'crm';
  const ios = window.navigator as Navigator & { standalone?: boolean };
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches
    ? 'standalone'
    : 'browser';
  return detectCsdChatShell({
    search: window.location.search,
    displayMode,
    iosStandalone: ios.standalone === true,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts`

Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/csd-chat-shell.ts services/ops-web/src/lib/crm/csd-chat-shell.spec.ts
git commit -m "feat(crm): detect Chat SD phone and desktop shells"
```

---

### Task 2: Login quay lại đúng vỏ

`useCsdPageAuth` hiện `router.replace('/login')` và làm mất `?shell=desktop` cùng `?c=`. `StaffRouteGuard` đã có `next`.

**Files:**
- Create: `services/ops-web/src/lib/auth/login-next.util.ts`
- Test: `services/ops-web/src/lib/auth/login-next.util.spec.ts`
- Modify: `services/ops-web/src/components/crm/csd/useCsdPageAuth.ts`

**Interfaces:**
- Consumes: pathname + search
- Produces: `loginHrefWithNext(pathAndQuery: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { loginHrefWithNext } from './login-next.util';

describe('loginHrefWithNext', () => {
  it('keeps the desktop shell and conversation on the return path', () => {
    expect(loginHrefWithNext('/crm/csd/chat?shell=desktop&c=abc')).toBe(
      '/login?next=%2Fcrm%2Fcsd%2Fchat%3Fshell%3Ddesktop%26c%3Dabc',
    );
  });

  it('rejects an off-site return path', () => {
    expect(loginHrefWithNext('https://evil.example/crm/csd/chat')).toBe('/login');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/auth/login-next.util.spec.ts`

Expected: FAIL, module missing

- [ ] **Step 3: Write minimal implementation**

```ts
export function loginHrefWithNext(pathAndQuery: string): string {
  if (!pathAndQuery.startsWith('/') || pathAndQuery.startsWith('//')) return '/login';
  return `/login?next=${encodeURIComponent(pathAndQuery)}`;
}
```

Trong `useCsdPageAuth.ts`, mỗi `router.replace('/login')` và `router.push('/login')` đổi thành:

```ts
const next =
  typeof window === 'undefined'
    ? '/crm/csd/chat'
    : `${window.location.pathname}${window.location.search}`;
router.replace(loginHrefWithNext(next));
```

`logout` dùng `router.push(loginHrefWithNext(next))` với cùng `next`. Import `loginHrefWithNext` từ `@/lib/auth/login-next.util`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/auth/login-next.util.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/auth/login-next.util.ts services/ops-web/src/lib/auth/login-next.util.spec.ts services/ops-web/src/components/crm/csd/useCsdPageAuth.ts
git commit -m "fix(crm): return staff to the Chat SD shell after login"
```

---

### Task 3: Manifest Chat SD, không đụng PWA lead

**Files:**
- Create: `services/ops-web/public/csd-chat-manifest.webmanifest`
- Create: `services/ops-web/src/app/crm/csd/chat/layout.tsx`
- Modify: `services/ops-web/src/middleware.ts` (`isStaticAsset`)
- Test: `services/ops-web/src/lib/crm/csd-chat-manifest.spec.ts`

**Interfaces:**
- Consumes: icon có sẵn `/icons/icon-192.png`, `/icons/icon-512.png`
- Produces: manifest chỉ được link từ layout chat

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Chat SD manifest', () => {
  it('starts on chat and does not replace the lead-care manifest', () => {
    const raw = readFileSync(
      resolve(__dirname, '../../../public/csd-chat-manifest.webmanifest'),
      'utf8',
    );
    const manifest = JSON.parse(raw) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
    };
    expect(manifest.name).toBe('Chat SD');
    expect(manifest.short_name).toBe('Chat SD');
    expect(manifest.start_url).toBe('/crm/csd/chat?shell=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });
});
```

`scope` là `/` vì chat gọi `/api` cùng origin và trang login `/login`. `start_url` mang `shell=pwa` để sau redirect login vẫn nhận ra vỏ khi query được giữ (Task 2).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-manifest.spec.ts`

Expected: FAIL, file not found

- [ ] **Step 3: Write the manifest and layout**

`public/csd-chat-manifest.webmanifest`:

```json
{
  "name": "Chat SD",
  "short_name": "Chat SD",
  "description": "Chat nội bộ PTT",
  "start_url": "/crm/csd/chat?shell=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#eef1f5",
  "theme_color": "#0f2747",
  "lang": "vi",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`src/app/crm/csd/chat/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat SD',
  description: 'Chat nội bộ',
  manifest: '/csd-chat-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Chat SD' },
};

export default function CsdChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Trong `isStaticAsset` của `middleware.ts`, thêm:

```ts
pathname === '/csd-chat-manifest.webmanifest'
```

Không sửa `src/app/manifest.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-manifest.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/public/csd-chat-manifest.webmanifest services/ops-web/src/app/crm/csd/chat/layout.tsx services/ops-web/src/middleware.ts services/ops-web/src/lib/crm/csd-chat-manifest.spec.ts
git commit -m "feat(crm): add a Chat SD home-screen manifest"
```

---

### Task 4: Ẩn chrome CRM trên PWA và Desktop

**Files:**
- Modify: `services/ops-web/src/components/layout/StaffPageShell.tsx`
- Modify: `services/ops-web/src/app/crm/csd/chat/page.tsx`
- Modify: CSS chat hiện có (class `csd-chat-page` trong `services/ops-web/src/app/globals.css` hoặc file CSS đang chứa `.csd-chat-page`)

**Interfaces:**
- Consumes: `readCsdChatShell()` từ Task 1
- Produces: `StaffPageShell` prop `chrome?: 'crm' | 'chat'`

- [ ] **Step 1: Add the shell prop**

`StaffPageShell`:

```tsx
chrome?: 'crm' | 'chat';
```

Mặc định `'crm'`. Khi `chrome === 'chat'`:

- Không render `OpsNav`, `SlaAlertToastHost`, `B2bHotAlarm`, `CsdChatDock`.
- Vẫn render `CsdChatNotifyHost` khi có `user`.
- Không render breadcrumb. `OpsPage` nhận `width="full"`.

- [ ] **Step 2: Wire the chat page**

Trong `CsdChatPageInner`, gọi `readCsdChatShell()` sau mount (state, vì `window` không có lúc SSR):

```tsx
const [shell, setShell] = useState<'crm' | 'pwa' | 'desktop'>('crm');
useEffect(() => {
  setShell(readCsdChatShell());
}, []);
const chatChrome = shell === 'crm' ? 'crm' : 'chat';
```

Truyền `chrome={chatChrome}` vào cả `StaffPageShell` đang tải và shell chính. Khi `chatChrome === 'chat'`, không render `PageToolbar`.

Dưới form login chat, khi `shell === 'pwa'`, hiện một dòng:

```tsx
<p className="muted" data-testid="csd-chat-pwa-sleep-note">
  Khi điện thoại ngủ, tin mới có thể đến chậm đến lúc mở lại Chat SD. Không có đẩy tin nền.
</p>
```

- [ ] **Step 3: Safe area**

Thêm vào CSS `.csd-chat-page.is-shell`:

```css
.csd-chat-page.is-shell {
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom);
}
.csd-chat-page.is-shell .csd-chat-compose {
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
```

Gắn class `is-shell` khi `chatChrome === 'chat'`. Ô nhập đã có class `csd-chat-compose` trong `CsdChatThread.tsx`. Không đổi logic gửi tin.

- [ ] **Step 4: Check types**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts src/lib/auth/login-next.util.spec.ts`

Expected: PASS. Mở `/crm/csd/chat` trên desktop browser vẫn thấy menu CRM. Mở `/crm/csd/chat?shell=desktop` không thấy `OpsNav`.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/layout/StaffPageShell.tsx services/ops-web/src/app/crm/csd/chat/page.tsx services/ops-web/src/app/globals.css
git commit -m "feat(crm): hide CRM chrome in the Chat SD phone and desktop shells"
```

Nếu safe-area nằm file CSS khác `globals.css`, commit đúng file đó.

---

### Task 5: Ticket trong vỏ mở tab CRM

**Files:**
- Modify: `services/ops-web/src/components/crm/csd/CsdChatContext.tsx` (Link ticket khoảng dòng 506)
- Modify: `services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx` (truyền cờ)

**Interfaces:**
- Consumes: `readCsdChatShell()`
- Produces: prop `openTicketsInNewTab?: boolean` trên `CsdChatContext`

- [ ] **Step 1: Pass the flag**

`CsdChatWorkspace` đọc `readCsdChatShell()` một lần khi mount. `openTicketsInNewTab = shell !== 'crm'`. Truyền vào `CsdChatContext`.

- [ ] **Step 2: Render the link**

Khi `openTicketsInNewTab` là true, thay `Link` ticket bằng:

```tsx
<a
  href={`/crm/csd/tickets/${t.id}`}
  className="csd-chat-ticket-pill"
  target="_blank"
  rel="noopener noreferrer"
>
  {t.code} · {t.priority} · {t.status}
</a>
```

Giữ `<span className="csd-chat-context-sub">{t.title}</span>` ngay sau link. Giữ nguyên `Link` khi cờ false. Không thêm menu Lead/KPI.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/components/crm/csd/CsdChatContext.tsx services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx
git commit -m "feat(crm): open CSD tickets outside the Chat SD shell"
```

P1 xong ở task này. Chức năng mục 5 của spec (tin, nhóm, bạn, gọi DM, kho, AI) là UI đang chạy trong `CsdChatWorkspace`. Không viết lại.

---

### Task 6: Desktop D1 — cửa sổ và khay

**Files:**
- Create: `services/ops-desktop/package.json`
- Create: `services/ops-desktop/main.js`
- Create: `services/ops-desktop/preload.js`
- Create: `services/ops-desktop/README.md`

**Interfaces:**
- Consumes: URL `OPS_DESKTOP_CHAT_URL` mặc định `https://rs.pttads.vn/crm/csd/chat?shell=desktop`
- Produces: process Electron, khay “Thoát”, đóng cửa sổ = ẩn

- [ ] **Step 1: package.json**

```json
{
  "name": "ops-desktop",
  "private": true,
  "version": "0.1.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir"
  },
  "devDependencies": {
    "electron": "33.4.11",
    "electron-builder": "25.1.8",
    "electron-updater": "6.6.2"
  }
}
```

- [ ] **Step 2: main.js**

```js
const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

const chatUrl = process.env.OPS_DESKTOP_CHAT_URL
  || 'https://rs.pttads.vn/crm/csd/chat?shell=desktop';

let win = null;
let tray = null;
let quitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Chat SD',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(chatUrl);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
}

app.whenReady().then(() => {
  createWindow();
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Chat SD');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở Chat SD', click: () => { win.show(); win.focus(); } },
    { label: 'Thoát', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => { win.show(); win.focus(); });
});

app.on('before-quit', () => { quitting = true; });
```

Khay dùng icon rỗng cho đến khi có file `services/ops-desktop/icon.png` 16×16. Không bịa badge số ở task này (Task 8).

- [ ] **Step 3: preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rnosDesktop', {
  shell: 'desktop',
  focus() { ipcRenderer.send('chat-sd-focus'); },
  setUnread(count) { ipcRenderer.send('chat-sd-unread', count); },
});
```

Trong `main.js`, trước `createWindow`:

```js
const { ipcMain } = require('electron');
ipcMain.on('chat-sd-focus', () => { if (win) { win.show(); win.focus(); } });
ipcMain.on('chat-sd-unread', (_event, count) => {
  const n = Number(count);
  if (!tray || !Number.isFinite(n)) return;
  tray.setToolTip(n > 0 ? `Chat SD · ${n} chưa đọc` : 'Chat SD');
});
```

Chưa gọi `shell.openPath` ở task này.

- [ ] **Step 4: README một đoạn**

Ghi: `cd services/ops-desktop && npm install && npm start`. Cửa sổ không có thanh địa chỉ. Đóng cửa sổ thu vào khay. Thoát từ menu khay. Nội dung là web đã deploy.

Tự cập nhật vỏ chỉ khi có URL thật. Trong `main.js`, sau `app.whenReady`:

```js
const feed = process.env.OPS_DESKTOP_UPDATE_URL;
if (feed) {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.setFeedURL({ provider: 'generic', url: feed });
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}
```

Thêm dependency `electron-updater` cùng phiên bản major với `electron-builder` 25. Không đặt URL mặc định. Không có biến này thì app không gọi mạng cập nhật.

- [ ] **Step 5: Commit**

```bash
git add services/ops-desktop
git commit -m "feat(crm): add the Chat SD desktop window and tray"
```

---

### Task 7: Desktop D2 — cầu file

**Files:**
- Modify: `services/ops-desktop/preload.js`
- Modify: `services/ops-desktop/main.js`
- Create: `services/ops-web/src/lib/crm/csd-chat-desktop-bridge.ts`
- Test: `services/ops-web/src/lib/crm/csd-chat-desktop-bridge.spec.ts`
- Modify: `services/ops-web/src/lib/crm/csd-chat-file-local.ts` (`openCsdChatFile`, `saveCsdChatFileToDisk`, `revealCsdChatFileInFolder`)

**Interfaces:**
- Produces:

```ts
export type RnosDesktopBridge = {
  shell: 'desktop';
  focus: () => void;
  setUnread: (count: number) => void;
  openFile: (filePath: string) => Promise<boolean>;
  revealInFolder: (filePath: string) => Promise<boolean>;
  saveFile: (bytes: ArrayBuffer, fileName: string, fileId: string) => Promise<string | null>;
  hasLocalFile: (fileId: string) => Promise<string | null>;
};

export function readRnosDesktop(): RnosDesktopBridge | null
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { readRnosDesktop } from './csd-chat-desktop-bridge';

describe('readRnosDesktop', () => {
  it('returns null when the page is a normal browser', () => {
    expect(readRnosDesktop()).toBeNull();
  });
});
```

- [ ] **Step 2: Implement the reader**

```ts
export function readRnosDesktop(): RnosDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as Window & { rnosDesktop?: RnosDesktopBridge }).rnosDesktop;
  if (!bridge || bridge.shell !== 'desktop' || typeof bridge.openFile !== 'function') return null;
  return bridge;
}
```

- [ ] **Step 3: Main process file handlers**

Trong `main.js`:

```js
const { ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const os = require('os');

function chatDir() {
  const dir = path.join(os.homedir(), 'RNOSAI', 'CSD-Chat');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('chat-sd-open-file', async (_e, filePath) => {
  if (typeof filePath !== 'string' || !filePath.startsWith(chatDir())) return false;
  const err = await shell.openPath(filePath);
  return err === '';
});
ipcMain.handle('chat-sd-reveal', async (_e, filePath) => {
  if (typeof filePath !== 'string' || !filePath.startsWith(chatDir())) return false;
  shell.showItemInFolder(filePath);
  return true;
});
ipcMain.handle('chat-sd-save', async (_e, bytes, fileName) => {
  const safe = path.basename(String(fileName || 'file'));
  const dest = path.join(chatDir(), safe);
  fs.writeFileSync(dest, Buffer.from(bytes));
  return dest;
});
ipcMain.handle('chat-sd-has', async (_e, fileId) => {
  const marker = path.join(chatDir(), `${String(fileId)}.path`);
  if (!fs.existsSync(marker)) return null;
  const target = fs.readFileSync(marker, 'utf8').trim();
  return fs.existsSync(target) ? target : null;
});
```

`chat-sd-save` ghi thêm file marker `${fileId}.path` khi preload gửi `fileId`. Preload:

```js
openFile: (filePath) => ipcRenderer.invoke('chat-sd-open-file', filePath),
revealInFolder: (filePath) => ipcRenderer.invoke('chat-sd-reveal', filePath),
saveFile: (bytes, fileName, fileId) => ipcRenderer.invoke('chat-sd-save', bytes, fileName, fileId),
hasLocalFile: (fileId) => ipcRenderer.invoke('chat-sd-has', fileId),
```

`save` chỉ ghi trong `~/RNOSAI/CSD-Chat/`. `openFile` từ chối path nằm ngoài thư mục đó.

- [ ] **Step 4: Use the bridge from the web file helpers**

Đầu `openCsdChatFile`: nếu `readRnosDesktop()` và `hasLocalFile(file.id)` trả path, gọi `openFile(path)` rồi return. Không có path thì tải blob như hiện tại, `saveFile`, rồi `openFile`. Không gọi `window.open` khi bridge đã mở được file.

`saveCsdChatFileToDisk`: nếu có bridge, `saveFile` rồi return, không `showSaveFilePicker`.

`revealCsdChatFileInFolder`: nếu có bridge và có path local, `revealInFolder`. Không có bridge: giữ `showDirectoryPicker` / IndexedDB hiện tại.

- [ ] **Step 5: Run tests and commit**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-desktop-bridge.spec.ts src/lib/crm/csd-chat-file-local.spec.ts`

Expected: PASS. Sửa spec file-local nếu assertion cũ giả định luôn `window.open`.

```bash
git add services/ops-desktop services/ops-web/src/lib/crm/csd-chat-desktop-bridge.ts services/ops-web/src/lib/crm/csd-chat-desktop-bridge.spec.ts services/ops-web/src/lib/crm/csd-chat-file-local.ts services/ops-web/src/lib/crm/csd-chat-file-local.spec.ts
git commit -m "feat(crm): open Chat SD files in the desktop shell"
```

---

### Task 8: Badge khay và thông báo

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx` hoặc chỗ đã gọi `fetchCsdChatUnreadCount` (khoảng dòng 373)
- Modify: `services/ops-web/src/components/crm/csd/CsdChatNotifyHost.tsx`
- Modify: `services/ops-web/public/sw.js` chỉ nếu `notificationclick` không còn dùng `data.url`

**Interfaces:**
- Consumes: `readRnosDesktop().setUnread` và `.focus` từ Task 6–7
- Produces: tooltip khay đổi theo unread; bấm thông báo focus cửa sổ desktop

Service worker hiện đã `client.navigate(target)` với `event.notification.data.url`. `showCsdChatDesktopNotify` đã ghi `data.url` là `/crm/csd/chat?c=…`. Không thêm push server.

- [ ] **Step 1: Badge**

Sau khi `fetchCsdChatUnreadCount` trả `count` trong `OpsNav`, nếu `readRnosDesktop()` khác null thì `bridge.setUnread(count)`. Trang chat shell không mount `OpsNav`, nên gọi cùng fetch một lần trong `CsdChatPageInner` khi `shell === 'desktop'` và lặp mỗi 8 giây (đúng nhịp `POLL_MS` của `CsdChatNotifyHost`). Dừng interval khi unmount.

- [ ] **Step 2: Focus**

Trong `CsdChatNotifyHost`, trước `router.push` khi người dùng bấm toast hoặc notification `onOpen`, nếu `readRnosDesktop()` có `focus`, gọi `focus()`.

- [ ] **Step 3: Confirm the service worker target**

Đọc `public/sw.js` handler `notificationclick`. Target phải là `event.notification.data?.url`. Fallback hiện `/crm/b2b/leads` chỉ khi không có `data.url`. Không đổi fallback đó (lead/B2B đang dùng). Chat luôn gửi `data.url`.

- [ ] **Step 4: Run unit tests**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts src/lib/crm/csd-chat-desktop-bridge.spec.ts src/lib/crm/csd-chat-notify.spec.ts src/lib/crm/csd-chat-dock-persist.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/crm/csd/CsdChatNotifyHost.tsx services/ops-web/src/app/crm/csd/chat/page.tsx services/ops-web/src/components/OpsNav.tsx
git commit -m "feat(crm): show Chat SD unread on the desktop tray"
```

---

### Task 9: Cổng kiểm tra trên máy thật

Không tạo hội thoại, tin, ticket giả. Dùng tài khoản staff đã có chat bật.

- [ ] Web `/crm/csd/chat` vẫn có menu CRM và không có `window.rnosDesktop`.
- [ ] `/crm/csd/chat?shell=desktop` không có `OpsNav`. User chỉ `csd.view` xem được, không gửi.
- [ ] Safari/Chrome điện thoại: Thêm vào màn hình chính từ trang chat. Icon “Chat SD”. Mở icon vào chat, không vào `/crm/leads`. Dòng ngủ máy hiện khi `shell=pwa`.
- [ ] Back từ thread về danh sách rồi mở lại PWA, hội thoại đang chọn còn (persist dock/workspace hiện có).
- [ ] Nhóm: khóa gửi thì member thấy composer khóa. Ghim tin mới thay tin ghim cũ. Lời mời bạn chưa chấp nhận thì không tạo được DM.
- [ ] Nút gọi tắt trên nhóm và hội thoại khách, title “Chỉ hỗ trợ hội thoại DM”.
- [ ] `services/ops-desktop`: `npm start` mở chat production, đóng cửa sổ còn icon khay, Thoát thì hết process.
- [ ] File: trình duyệt thường vẫn mở tab. Trong desktop, file nằm dưới `~/RNOSAI/CSD-Chat/` và mở bằng app máy.
- [ ] `/admin/crm/csd/chat-accounts` chỉ mở từ web CRM đã đăng nhập admin.

Run lần cuối:

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts src/lib/auth/login-next.util.spec.ts src/lib/crm/csd-chat-manifest.spec.ts src/lib/crm/csd-chat-desktop-bridge.spec.ts src/lib/crm/csd-chat-file-local.spec.ts
```

Expected: PASS
