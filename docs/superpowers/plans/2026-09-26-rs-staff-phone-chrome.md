# Phone chrome và mật độ Lead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trên màn dưới 768px, rs.pttads.vn có hàng trên (Menu + ảnh tài khoản), thanh dưới có icon, và `/crm/leads` mở ra thấy Kanban hoặc thẻ thay vì hàng nút Excel và bốn ô KPI.

**Architecture:** Giữ `showRsMobileChrome` và class `html.rs-mobile-chrome`. Thanh dưới và hàng trên chỉ mount khi cờ đó đúng và shell không phải chat native/desktop. Trang Lead ẩn công cụ desktop bằng class, không đổi `loadLeads`, quyền, hay URL. Desktop từ 768px không nhận các class ẩn.

**Tech Stack:** Next.js 14 ops-web, React, Vitest 3, CSS trong `services/ops-web/src/app/globals.css`. Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-09-25-rs-staff-mobile-srs.md` phiên bản 1.2.  
**Mockup:** `docs/superpowers/mockups/2026-09-26-rs-lead-phone.html` (bố cục). Chấm số `1` trên mockup không đưa vào sản phẩm.

## Global Constraints

- Dưới 768px dùng chrome điện thoại. Từ 768px giữ menu desktop, cùng URL.
- Không thêm query `shell=mobile`. `shell=native` và `shell=desktop` không hiện thanh dưới và không hiện hàng trên. `shell=pwa` trên điện thoại vẫn hiện.
- Không banner cài app. Không đổi màu site sang tím. Giữ xanh `#17692f`.
- Không sửa `services/ops-web/src/app/manifest.ts`, `services/ptt-app/`, `services/mobile-shell/`.
- Không bịa lead, ticket, số KPI, hay chấm số. Không hiện chấm đỏ trên Chat hay nút Menu.
- Tiếng Việt. Nút tạo lead vẫn là liên kết `leadsNewHref`, chỉ hiện khi `canCreate`.
- Import/export vẫn tôn trọng `canImport` và quyền PII của `exportLeadsXlsx`.
- Không commit `services/ops-web/tsconfig.tsbuildinfo`, `docs/p11-verify/`, hay `node_modules/.vite/`.
- Không commit `docs/superpowers/mockups/staff-avatar.jpg`.

## File map

| File | Việc |
|---|---|
| `services/ops-web/src/lib/crm/rs-mobile-shell.ts` | Thêm `icon` trên tab và `staffDisplayInitials` |
| `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts` | Khóa icon và chữ cái |
| `services/ops-web/src/components/layout/RsMobileIcons.tsx` | SVG theo `id` |
| `services/ops-web/src/components/layout/RsMobileTabBar.tsx` | Icon trên nhãn, Đăng xuất là nút có icon |
| `services/ops-web/src/components/layout/RsMobileTopBar.tsx` | Menu trái và menu ảnh |
| `services/ops-web/src/components/layout/StaffPageShell.tsx` | Mount hàng trên khi `phone && !chatShell && user` |
| `services/ops-web/src/app/globals.css` | Thanh icon, hàng trên, toolbar Lead, ẩn KPI |
| `services/ops-web/src/components/crm/CrmLeadsImportExport.tsx` | Prop `layout` |
| `services/ops-web/src/app/crm/leads/LeadsPhoneMoreMenu.tsx` | Nút Thêm |
| `services/ops-web/src/app/crm/leads/LeadsPhoneFilterSheet.tsx` | Tấm Lọc |
| `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx` | Bọc trang, hàng nút điện thoại, ẩn dải KPI |

Kanban không cần file mới. `.crm-kanban` trong `services/ops-web/src/app/bitrix-theme.css` đã `overflow-x: auto`, cột `flex: 0 0 260px` dưới 960px.

---

### Task 1: Thanh dưới có icon

**Files:**
- Modify: `services/ops-web/src/lib/crm/rs-mobile-shell.ts`
- Test: `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts`
- Create: `services/ops-web/src/components/layout/RsMobileIcons.tsx`
- Modify: `services/ops-web/src/components/layout/RsMobileTabBar.tsx`
- Modify: `services/ops-web/src/app/globals.css` (khối `.rs-mobile-tabbar` khoảng dòng 24814)

**Interfaces:**
- Consumes: `RS_MOBILE_TABS`, `rsMobileTabId`, `RsMobileTabBar` props `{ pathname, onLogout }`.
- Produces: mỗi tab có `icon: RsMobileTabId` trùng `id`. `RsMobileIcon({ id })` render SVG `aria-hidden`.

- [ ] **Step 1: Write the failing test**

Thêm vào `describe('RS_MOBILE_TABS')` trong `rs-mobile-shell.spec.ts`:

```ts
it('gives each tab an icon id and no badge count', () => {
  expect(RS_MOBILE_TABS.map((tab) => tab.icon)).toEqual(['leads', 'cskh', 'chat', 'tickets']);
  expect(RS_MOBILE_TABS.every((tab) => tab.icon === tab.id)).toBe(true);
  expect(JSON.stringify(RS_MOBILE_TABS)).not.toMatch(/badge|unread/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: FAIL because `icon` is undefined.

- [ ] **Step 3: Add the icon field**

Trong `rs-mobile-shell.ts`, đổi kiểu mảng:

```ts
export const RS_MOBILE_TABS: ReadonlyArray<{
  id: RsMobileTabId;
  label: string;
  href: string;
  icon: RsMobileTabId;
}> = [
  { id: 'leads', label: 'Lead', href: '/crm/leads', icon: 'leads' },
  { id: 'cskh', label: 'CSKH', href: '/crm/cskh-board', icon: 'cskh' },
  { id: 'chat', label: 'Chat', href: '/crm/csd/chat', icon: 'chat' },
  { id: 'tickets', label: 'Ticket', href: '/crm/csd/tickets', icon: 'tickets' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: PASS. Các test cũ vẫn pass.

- [ ] **Step 5: Render the icons**

Tạo `RsMobileIcons.tsx`:

```tsx
import type { RsMobileTabId } from '@/lib/crm/rs-mobile-shell';

type RsMobileIconProps = {
  id: RsMobileTabId | 'logout';
};

export function RsMobileIcon({ id }: RsMobileIconProps) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (id === 'leads') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16 14.5c2.2.3 3.8 1.6 4.5 4" />
      </svg>
    );
  }
  if (id === 'cskh') {
    return (
      <svg {...common}>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <rect x="3" y="13" width="4" height="6" rx="1.2" />
        <rect x="17" y="13" width="4" height="6" rx="1.2" />
      </svg>
    );
  }
  if (id === 'chat') {
    return (
      <svg {...common}>
        <path d="M5 16.5 4 20l3.8-1.4A8 8 0 1 0 5 16.5Z" />
      </svg>
    );
  }
  if (id === 'tickets') {
    return (
      <svg {...common}>
        <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-1.5L13 20l-3-1.5L7 20V6a2 2 0 0 1 0-2Z" />
        <path d="M9 9h6M9 13h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h10" />
      <path d="m11 8 4 4-4 4" />
    </svg>
  );
}
```

Đổi `RsMobileTabBar.tsx` thành:

```tsx
'use client';

import Link from 'next/link';
import { RS_MOBILE_TABS, rsMobileTabId } from '@/lib/crm/rs-mobile-shell';
import { RsMobileIcon } from './RsMobileIcons';

type RsMobileTabBarProps = {
  pathname: string;
  onLogout: () => void;
};

export function RsMobileTabBar({ pathname, onLogout }: RsMobileTabBarProps) {
  const active = rsMobileTabId(pathname);
  return (
    <nav className="rs-mobile-tabbar" aria-label="PTT CRM">
      <div className="rs-mobile-tabbar__tabs">
        {RS_MOBILE_TABS.map((tab) => (
          <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? 'page' : undefined}>
            <RsMobileIcon id={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
      <button type="button" className="rs-mobile-tabbar__logout" onClick={onLogout}>
        <RsMobileIcon id="logout" />
        <span>Đăng xuất</span>
      </button>
    </nav>
  );
}
```

Thay khối CSS `.rs-mobile-tabbar__tabs a` và `.rs-mobile-tabbar__logout` bằng:

```css
.rs-mobile-tabbar__tabs a,
.rs-mobile-tabbar__logout {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
  padding: 0.35rem 0.1rem 0.2rem;
  font-size: 0.68rem;
  line-height: 1.1;
  text-decoration: none;
  position: relative;
}

.rs-mobile-tabbar__tabs a[aria-current='page'] {
  color: #17692f;
  font-weight: 700;
  background: rgba(23, 105, 47, 0.08);
}

.rs-mobile-tabbar__tabs a[aria-current='page']::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18%;
  right: 18%;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: #17692f;
}
```

Giữ `.rs-mobile-tabbar` fixed đáy, `z-index: 40`, và padding safe-area hiện có. Không thêm phần tử badge.

- [ ] **Step 6: Commit**

```bash
git add services/ops-web/src/lib/crm/rs-mobile-shell.ts \
  services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts \
  services/ops-web/src/components/layout/RsMobileIcons.tsx \
  services/ops-web/src/components/layout/RsMobileTabBar.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): show icons on the phone tab bar

EOF
)"
```

---

### Task 2: Hàng trên — Menu và ảnh tài khoản

**Files:**
- Modify: `services/ops-web/src/lib/crm/rs-mobile-shell.ts`
- Test: `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts`
- Create: `services/ops-web/src/components/layout/RsMobileTopBar.tsx`
- Modify: `services/ops-web/src/components/layout/StaffPageShell.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: `RS_MOBILE_TABS`, `rsMobileTabId`, `RsMobileIcon`, `getAccessToken()` từ `@/lib/auth`, `useStaffAvatarBlob(token, hasAvatar, avatarUpdatedAt)`, `StoredStaffUser` (`display_name`, `email`, `has_avatar`, `avatar_updated_at`), `onLogout` của shell.
- Produces: `staffDisplayInitials(name: string | null | undefined): string`. `RsMobileTopBar` props `{ user, pathname, onLogout }`. `StaffPageShell` chỉ render nó khi `phone && chrome !== 'chat' && user`.

- [ ] **Step 1: Write the failing test**

Thêm describe mới trong `rs-mobile-shell.spec.ts`:

```ts
import { staffDisplayInitials } from './rs-mobile-shell';

describe('staffDisplayInitials', () => {
  it('uses the first and last word', () => {
    expect(staffDisplayInitials('Quản trị hệ thống')).toBe('QT');
  });

  it('uses two letters of a single word', () => {
    expect(staffDisplayInitials('Admin')).toBe('AD');
  });

  it('uses a question mark when the name is empty', () => {
    expect(staffDisplayInitials('  ')).toBe('?');
    expect(staffDisplayInitials(null)).toBe('?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: FAIL, `staffDisplayInitials` is not exported.

- [ ] **Step 3: Implement initials**

Thêm vào cuối `rs-mobile-shell.ts`:

```ts
export function staffDisplayInitials(name: string | null | undefined): string {
  const raw = name?.trim() || '?';
  if (raw === '?') return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: PASS.

- [ ] **Step 5: Build the top bar**

Tạo `RsMobileTopBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStaffAvatarBlob } from '@/components/account/useStaffAvatarBlob';
import { getAccessToken, type StoredStaffUser } from '@/lib/auth';
import { RS_MOBILE_TABS, rsMobileTabId, staffDisplayInitials } from '@/lib/crm/rs-mobile-shell';
import { RsMobileIcon } from './RsMobileIcons';

type RsMobileTopBarProps = {
  user: StoredStaffUser;
  pathname: string;
  onLogout: () => void;
};

export function RsMobileTopBar({ user, pathname, onLogout }: RsMobileTopBarProps) {
  const [token, setToken] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const avatarUrl = useStaffAvatarBlob(token, Boolean(user.has_avatar), user.avatar_updated_at);
  const initials = staffDisplayInitials(user.display_name || user.email);
  const active = rsMobileTabId(pathname);

  useEffect(() => {
    setToken(getAccessToken());
  }, [user.email]);

  useEffect(() => {
    if (!navOpen && !accountOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, accountOpen]);

  return (
    <>
      <header className="rs-mobile-topbar">
        <button
          type="button"
          className="rs-mobile-topbar__menu"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => {
            setAccountOpen(false);
            setNavOpen((open) => !open);
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
        <button
          type="button"
          className="rs-mobile-topbar__avatar"
          aria-label="Tài khoản"
          aria-expanded={accountOpen}
          onClick={() => {
            setNavOpen(false);
            setAccountOpen((open) => !open);
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
      </header>
      {navOpen ? (
        <button type="button" className="rs-mobile-scrim" aria-label="Đóng" onClick={() => setNavOpen(false)} />
      ) : null}
      {navOpen ? (
        <nav className="rs-mobile-drawer" aria-label="Menu">
          {RS_MOBILE_TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active === tab.id ? 'page' : undefined}
              onClick={() => setNavOpen(false)}
            >
              <RsMobileIcon id={tab.icon} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {accountOpen ? (
        <button type="button" className="rs-mobile-scrim" aria-label="Đóng" onClick={() => setAccountOpen(false)} />
      ) : null}
      {accountOpen ? (
        <div className="rs-mobile-account" role="menu">
          <p className="rs-mobile-account__name">{user.display_name || user.email}</p>
          <p className="rs-mobile-account__email">{user.email}</p>
          <Link href="/account" role="menuitem" onClick={() => setAccountOpen(false)}>
            Tài khoản
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAccountOpen(false);
              onLogout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </>
  );
}
```

Trong `StaffPageShell.tsx`, import `RsMobileTopBar` và, ngay trước `<OpsPage`, thêm:

```tsx
{phone && !chatShell && user ? (
  <RsMobileTopBar user={user} pathname={pathname} onLogout={onLogout} />
) : null}
```

Giữ nguyên dòng children:

```tsx
{loading || (!user && !chatShell) ? <p className="muted">Đang tải…</p> : children}
```

Giữ `{phone ? <RsMobileTabBar ... /> : null}`. `phone` đã là false khi `shell=native` hoặc `shell=desktop`, nên hàng trên cũng tắt theo FR-14 và FR-22.

Thêm CSS sau khối `.rs-mobile-tabbar`:

```css
.rs-mobile-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.25rem;
  padding: env(safe-area-inset-top, 0px) 0.75rem 0;
  background: var(--surface, #fff);
  border-bottom: 1px solid var(--border, #d9e0dc);
}

.rs-mobile-topbar__menu,
.rs-mobile-topbar__avatar {
  border: 0;
  background: transparent;
  color: inherit;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
}

.rs-mobile-topbar__avatar {
  overflow: hidden;
  background: #17692f;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}

.rs-mobile-topbar__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rs-mobile-scrim {
  position: fixed;
  inset: 0;
  z-index: 55;
  border: 0;
  background: rgba(0, 0, 0, 0.28);
}

.rs-mobile-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 60;
  width: min(18rem, 86vw);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: calc(4rem + env(safe-area-inset-top, 0px)) 0.75rem 1rem;
  background: var(--surface, #fff);
}

.rs-mobile-drawer a {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 0.6rem;
  border-radius: 0.6rem;
  text-decoration: none;
  color: inherit;
}

.rs-mobile-drawer a[aria-current='page'] {
  color: #17692f;
  background: rgba(23, 105, 47, 0.08);
  font-weight: 700;
}

.rs-mobile-account {
  position: fixed;
  top: calc(3.25rem + env(safe-area-inset-top, 0px));
  right: 0.5rem;
  z-index: 60;
  width: min(16rem, 80vw);
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #d9e0dc);
  border-radius: 0.75rem;
}

.rs-mobile-account__name {
  margin: 0;
  font-weight: 700;
}

.rs-mobile-account__email {
  margin: 0.15rem 0 0.5rem;
  color: var(--muted, #5c6b63);
  font-size: 0.85rem;
}

.rs-mobile-account a,
.rs-mobile-account button {
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.55rem 0.2rem;
  text-decoration: none;
}

html.rs-mobile-chrome body:has(.ops-sidebar) main,
html.rs-mobile-chrome main {
  padding-top: calc(3.25rem + env(safe-area-inset-top, 0px)) !important;
}
```

Rule `main` hiện đã có `padding-bottom`. Gộp `padding-top` vào cùng selector, đừng tạo rule sau ghi đè mất `padding-bottom`.

- [ ] **Step 6: Commit**

```bash
git add services/ops-web/src/lib/crm/rs-mobile-shell.ts \
  services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts \
  services/ops-web/src/components/layout/RsMobileTopBar.tsx \
  services/ops-web/src/components/layout/StaffPageShell.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): add the phone menu and account avatar

EOF
)"
```

---

### Task 3: Hàng tiêu đề Lead và menu Thêm

**Files:**
- Modify: `services/ops-web/src/components/crm/CrmLeadsImportExport.tsx`
- Create: `services/ops-web/src/app/crm/leads/LeadsPhoneMoreMenu.tsx`
- Modify: `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: props hiện tại của `CrmLeadsImportExport` (`token`, `query`, `selectedIds`, `canImport`, `onImported`, `onError`) và `LeadsColumnPicker`.
- Produces: `layout?: 'buttons' | 'menu'`, mặc định `'buttons'`. Nút **Thêm** class `crm-leads-phone-only`. Khối nút desktop class `crm-leads-desktop-tools`. Trang bọc class `crm-leads-page`.

- [ ] **Step 1: Add `layout` without changing the button branch**

Trong `CrmLeadsImportExport`, thêm `layout = 'buttons'` vào props. Nhánh `layout === 'buttons'` giữ nguyên JSX hiện tại (nút, input `#crm-leads-import-file`, wizard, summary). Nhánh `menu` render:

```tsx
<div className="crm-leads-io crm-leads-io--menu" role="group" aria-label="Excel">
  <button type="button" role="menuitem" disabled={busy != null} onClick={() => void onDownloadTemplate()}>
    {busy === 'template' ? 'Đang tải…' : 'Mẫu Excel'}
  </button>
  {canImport ? (
    <>
      <button type="button" role="menuitem" disabled={busy != null} onClick={() => setWizardOpen(true)}>
        Import wizard
      </button>
      <button type="button" role="menuitem" disabled={busy != null} onClick={() => void onPickImport()}>
        {busy === 'import' ? 'Đang import…' : 'Import nhanh'}
      </button>
    </>
  ) : null}
  <button type="button" role="menuitem" disabled={busy != null} onClick={() => void onExport(true)}>
    {busy === 'export-all' ? 'Đang xuất…' : 'Export Excel (filter)'}
  </button>
  <button
    type="button"
    role="menuitem"
    disabled={busy != null || selectedIds.length === 0}
    onClick={() => void onExport(false)}
  >
    {busy === 'export-selected' ? 'Đang xuất…' : `Export đã chọn (${selectedIds.length})`}
  </button>
  {canImport ? (
    <input
      ref={fileRef}
      id="crm-leads-import-file"
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      hidden
      onChange={(e) => void onImportFile(e.target.files?.[0])}
    />
  ) : null}
  {importSummary ? (
    <div className="crm-leads-io__summary" role="status">
      <p>
        Import: <strong>{importSummary.created}</strong> lead mới
      </p>
    </div>
  ) : null}
  {canImport ? (
    <WinExcelImportWizard
      open={wizardOpen}
      mode="leads"
      token={token}
      onClose={() => setWizardOpen(false)}
      onComplete={onImported}
      onError={onError}
    />
  ) : null}
</div>
```

Input file chỉ được mount một lần. Nhánh `buttons` đã có input đó, nên nhánh `menu` giữ input như trên và nhánh `buttons` không render thêm id trùng. Hai nhánh là if/else, không cùng lúc.

- [ ] **Step 2: More menu**

Tạo `LeadsPhoneMoreMenu.tsx`. Props:

```ts
type LeadsPhoneMoreMenuProps = {
  token: string | null;
  query: string;
  selectedIds: number[];
  canImport: boolean;
  visibleColumns: ComponentProps<typeof LeadsColumnPicker>['visible'];
  showScores: boolean;
  showLeadKindTags: boolean;
  onColumnsChange: ComponentProps<typeof LeadsColumnPicker>['onChange'];
  onImported: () => void;
  onError: (message: string) => void;
};
```

Nút chữ **Thêm**, `aria-expanded`, `aria-haspopup="menu"`. Bấm ra ngoài (`mousedown` ngoài root) hoặc Escape thì đóng. Bên trong `role="menu"`: `LeadsColumnPicker` rồi, khi có `token`, `CrmLeadsImportExport` với `layout="menu"`. Class nút: `btn btn-sm crm-leads-phone-only`.

- [ ] **Step 3: Wire the lead page**

Trong return của `CrmLeadsPageContent`, bọc từ `PageToolbar` đến hết children của `StaffPageShell` bằng `<div className="crm-leads-page">`.

Trong `actions` của `PageToolbar`:

- Bọc `LeadsColumnPicker` và `CrmLeadsImportExport` (không truyền `layout`, tức `buttons`) trong `<div className="crm-leads-desktop-tools">`.
- Giữ link “+ Tạo lead” và thêm class `crm-leads-create`.
- Khi `canCreate`, thêm link cùng `href={leadsNewHref(flowScope)}`, class `btn btn-sm crm-leads-phone-only`, `aria-label="Tạo lead"`, chữ `+`.
- Render `LeadsPhoneMoreMenu` cạnh đó, truyền đúng state đã có trên trang (`visibleColumns`, `setVisibleColumns`, `showScores`, `showLeadKindTags`, `token`, `query`, `selectedList`, `canImport`, `onImported`, `setError`).

CSS:

```css
.crm-leads-phone-only {
  display: none;
}

html.rs-mobile-chrome .crm-leads-phone-only {
  display: inline-flex;
}

html.rs-mobile-chrome .crm-leads-desktop-tools,
html.rs-mobile-chrome .crm-leads-create {
  display: none;
}

html.rs-mobile-chrome .crm-leads-page .page-toolbar {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

html.rs-mobile-chrome .crm-leads-page .page-toolbar__title {
  flex: 1 1 auto;
  min-width: 0;
}

html.rs-mobile-chrome .crm-leads-page .page-toolbar__subtitle {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

html.rs-mobile-chrome .crm-leads-page .page-toolbar__actions {
  width: auto;
  flex: 0 0 auto;
  justify-content: flex-end;
}

html.rs-mobile-chrome .crm-leads-page .page-toolbar__actions .btn {
  flex: 0 0 auto;
}

.crm-leads-io--menu {
  display: flex;
  flex-direction: column;
}

.crm-leads-io--menu button {
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0.45rem 0.2rem;
}
```

Rule `flex: 1 1 auto` trong `@media (max-width: 960px)` vẫn áp cho desktop hẹp và tablet. Ngoại lệ chỉ nằm dưới `html.rs-mobile-chrome`.

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/components/crm/CrmLeadsImportExport.tsx \
  services/ops-web/src/app/crm/leads/LeadsPhoneMoreMenu.tsx \
  services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): tuck lead Excel tools into the phone menu

EOF
)"
```

---

### Task 4: Tấm Lọc

**Files:**
- Create: `services/ops-web/src/app/crm/leads/LeadsPhoneFilterSheet.tsx`
- Modify: `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: state đã có trên trang lead: `q`, `setQ`, `listTab`, `setListTab`, `leadKind`, `setLeadKind`, `filterStatus`, `setFilterStatus`, `filterSource`, `setFilterSource`, `filterChannel`, `setFilterChannel`, `canViewAllLeads`, `flowScope`, `statusOptions`, `sourceOptions`, `channelOptions`, `onSearch`, `loading`, `savedView`, `applyLeadP1View`, `canReviewQueue`, `reviewQueueCount`.
- Produces: nút **Lọc** class `crm-leads-phone-only`. Tấm `role="dialog"` `aria-modal="true"` `aria-label="Lọc lead"`. Khối lọc trên mặt trang class `crm-leads-inline-filters`.

- [ ] **Step 1: Hide the inline filters on the phone**

Bọc `SegmentedControl` chủ sở hữu, `SegmentedControl` loại lead, và `FilterBar` trong `<div className="crm-leads-inline-filters">`. `WinFilterChips` ở ngoài div đó, phía trên Kanban như hiện tại.

```css
html.rs-mobile-chrome .crm-leads-inline-filters {
  display: none;
}
```

- [ ] **Step 2: Sheet with the same controls**

`LeadsPhoneFilterSheet` có nút **Lọc** (`crm-leads-phone-only`) và, khi mở, một tấm. Bên trong copy đúng option của hai `SegmentedControl` và các `select` / `FilterBarSearch` đang nằm trong `FilterBar` (placeholder `Tìm tên, SĐT, email…`, nhãn aria `Lọc trạng thái`, `Lọc nguồn`, `Lọc kênh`). Nút submit gọi `onSearch` rồi `setOpen(false)`. Nút **Đóng** chỉ đóng tấm.

`onChange` của segmented gọi cùng guard: nếu `!canViewAllLeads && id !== 'mine'` thì return. `setOffset(0)` và `setSelectedIds(new Set())` truyền vào qua callback `onOwnerChange` / `onKindChange` do trang tạo, để sheet không tự biết offset.

Loại lead chỉ render khi `flowScope === 'spa_operational' || flowScope === 'all'`, giống khối hiện tại.

CSS:

```css
.leads-phone-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  max-height: 70vh;
  overflow: auto;
  padding: 0.75rem;
  background: var(--surface, #fff);
  border-top: 1px solid var(--border, #d9e0dc);
}
```

Tấm không đè `.rs-mobile-tabbar` (`z-index: 40`).

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/app/crm/leads/LeadsPhoneFilterSheet.tsx \
  services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): move lead filters into a phone sheet

EOF
)"
```

---

### Task 5: Ẩn dải KPI trên điện thoại

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: `<LeadSignalKpiStrip items={signalKpis} />`. Component này không nhận `className`. `data-testid` là `lead-signal-kpis`.
- Produces: wrapper `crm-leads-signal` chỉ `display: none` dưới `html.rs-mobile-chrome`.

- [ ] **Step 1: Wrap the strip**

Đổi dòng strip thành:

```tsx
<div className="crm-leads-signal">
  <LeadSignalKpiStrip items={signalKpis} />
</div>
```

```css
html.rs-mobile-chrome .crm-leads-signal {
  display: none;
}
```

Không sửa cách tính `signalKpis`. Không sửa `.crm-kanban` hay `.crm-kanban-column`.

- [ ] **Step 2: Commit**

```bash
git add services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): hide the lead KPI strip on the phone

EOF
)"
```

---

### Task 6: Xác nhận 390px, 1280px và shell chat

Không commit trong task này trừ khi bước dưới phát hiện lệch spec và phải sửa. Không tạo lead. Không bấm Export.

- [ ] **Step 1: Unit tests**

Run: `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: PASS, gồm test icon và `staffDisplayInitials`.

- [ ] **Step 2: Phone 390px**

Dev: `cd services/ops-web && NEXT_PUBLIC_PTT_API_URL=http://127.0.0.1:3000 npm run dev` (cổng 3200). Đăng nhập nhân viên thật.

Trên `/crm/leads` rộng 390:

- Có `.rs-mobile-topbar` với nút `aria-label="Menu"` và `aria-label="Tài khoản"`.
- Ảnh hiện khi `has_avatar`, không thì chữ cái.
- Menu mở bốn link đúng href. Không có chấm số.
- Menu ảnh có Tài khoản (`/account`) và Đăng xuất.
- Thanh dưới năm mục, mục Lead có `aria-current="page"` và một `svg`.
- Mặt trang không có chữ “Mẫu Excel”. Nút Thêm mở ra thì có.
- Nút Lọc mở tấm có ô tìm. Đóng tấm.
- Không thấy `[data-testid="lead-signal-kpis"]` (wrapper `display: none`).
- Hàng Kanban/Danh sách còn. Kanban cuộn ngang, cột không bị bóp full chiều ngang.
- Không có `.ops-sidebar`.

Đặt `q` một từ có lead thật, áp dụng, mở một lead, back. URL còn `q`.

- [ ] **Step 3: Desktop 1280px**

`/crm/leads`: có `.ops-sidebar`, không `.rs-mobile-tabbar`, không `.rs-mobile-topbar`, thấy “Mẫu Excel” và `[data-testid="lead-signal-kpis"]`.

- [ ] **Step 4: Native chat**

`/crm/csd/chat?shell=native` rộng 390: không `.rs-mobile-tabbar`, không `.rs-mobile-topbar`. Form vẫn chỉ mật khẩu chat.

- [ ] **Step 5: Sibling routes**

`/crm/cskh-board`, `/crm/csd/chat` (không shell), `/crm/csd/tickets` trên 390px vẫn có hàng trên và thanh dưới. Không đổi bố cục danh sách của ba trang đó trong bản này.

Mở một lead thật trên 390px. Tab vẫn là **Việc** và **Nhật ký**. Tab **AI** chỉ khi copilot đang bật. Không sửa các tab đó.
