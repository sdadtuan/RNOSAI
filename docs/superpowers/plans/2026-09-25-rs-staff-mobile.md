# PTT CRM mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make https://rs.pttads.vn usable on a phone for staff, under the name PTT CRM, without publishing that site as a store app.

**Architecture:** Below 768px, `StaffPageShell` hides the desktop sidebar and the chat dock, and shows a four-item bar plus Đăng xuất. The same URLs stay desktop at 768px and above. Login, session, and APIs stay as they are. The store app remains `services/ptt-app` (chat only).

**Tech Stack:** Next.js ops-web, Vitest. No Capacitor project. No new Nest route.

**Spec:** `docs/superpowers/specs/2026-09-25-rs-staff-mobile-srs.md` version 1.1

## Global Constraints

- PTT CRM is the phone layout of `https://rs.pttads.vn`. Do not create a bundle id. Do not add `services/ptt-crm-app`.
- Do not submit this site to the App Store or Google Play. Store submission stays on the chat app `vn.pttads.ptt`.
- Login is the existing staff email and password on `/login`. Chat on the site still uses `POST /api/crm/csd/chat/login` after that session.
- Do not add `shell=mobile`. Do not change `shell=native` or `shell=desktop`.
- Phone chrome is on only when `showRsMobileChrome` is true: viewport width `< 768`, and the query does not contain `shell=native` or `shell=desktop`.
- Do not change `services/ops-web/src/app/manifest.ts`. `start_url` stays `/crm/leads`.
- Bottom bar entries are only Lead, CSKH, Chat, Ticket. Đăng xuất is a text button, not a fifth tab.
- Do not invent leads, tickets, or KPI numbers in screenshots or tests.
- Do not add lead or ticket push. Do not edit `services/ptt-app` or `services/mobile-shell`.

## File map

| File | Job |
|------|-----|
| `services/ops-web/src/lib/crm/rs-mobile-shell.ts` | When phone chrome is on, and which tab is active |
| `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts` | Those two rules |
| `services/ops-web/src/components/layout/RsMobileTabBar.tsx` | Four links and Đăng xuất |
| `services/ops-web/src/components/layout/StaffPageShell.tsx` | Hide `OpsNav`, alarms, and `CsdChatDock` when the phone chrome is on |
| `services/ops-web/src/app/globals.css` | Bar, safe area, install banner above the bar |
| `services/ops-web/src/components/crm/csd/CsdTicketList.tsx` | Column names on the stacked ticket card |

---

### Task 1: Phone chrome rule

**Files:**
- Create: `services/ops-web/src/lib/crm/rs-mobile-shell.ts`
- Test: `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts`

**Interfaces:**
- Produces: `showRsMobileChrome(input: { width: number; search: string }): boolean`
- Produces: `rsMobileTabId(pathname: string): 'leads' | 'cskh' | 'chat' | 'tickets' | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { rsMobileTabId, showRsMobileChrome } from './rs-mobile-shell';

describe('showRsMobileChrome', () => {
  it('is on for a narrow staff page', () => {
    expect(showRsMobileChrome({ width: 390, search: '' })).toBe(true);
    expect(showRsMobileChrome({ width: 767, search: '' })).toBe(true);
  });

  it('is off from 768px up', () => {
    expect(showRsMobileChrome({ width: 768, search: '' })).toBe(false);
    expect(showRsMobileChrome({ width: 1280, search: '' })).toBe(false);
  });

  it('stays off for the chat store app and the desktop window', () => {
    expect(showRsMobileChrome({ width: 390, search: '?shell=native' })).toBe(false);
    expect(showRsMobileChrome({ width: 390, search: '?shell=desktop' })).toBe(false);
    expect(showRsMobileChrome({ width: 390, search: '?shell=native&c=1' })).toBe(false);
  });
});

describe('rsMobileTabId', () => {
  it('matches the four daily routes and their detail pages', () => {
    expect(rsMobileTabId('/crm/leads')).toBe('leads');
    expect(rsMobileTabId('/crm/leads/abc')).toBe('leads');
    expect(rsMobileTabId('/crm/cskh-board')).toBe('cskh');
    expect(rsMobileTabId('/crm/csd/chat')).toBe('chat');
    expect(rsMobileTabId('/crm/csd/tickets')).toBe('tickets');
    expect(rsMobileTabId('/crm/csd/tickets/abc')).toBe('tickets');
  });

  it('does not treat a longer sibling path as the lead tab', () => {
    expect(rsMobileTabId('/crm/leads-archive')).toBeNull();
    expect(rsMobileTabId('/crm/kpi')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

`showRsMobileChrome` returns false when `width >= 768`. It also returns false when `URLSearchParams` of `search` (strip one leading `?`) has `shell` equal to `native` or `desktop`. Otherwise it returns true.

`rsMobileTabId` checks these prefixes, longer paths first so `/crm/csd/tickets` is not confused with a shorter prefix:

```ts
const TABS = [
  ['/crm/csd/tickets', 'tickets'],
  ['/crm/csd/chat', 'chat'],
  ['/crm/cskh-board', 'cskh'],
  ['/crm/leads', 'leads'],
] as const;
```

A path matches when it equals the prefix or starts with `${prefix}/`.

- [ ] **Step 4: Run the test and confirm it passes**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/rs-mobile-shell.ts services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts
git commit -m "feat(crm): decide when the PTT CRM phone chrome is on"
```

---

### Task 2: Tab bar

**Files:**
- Create: `services/ops-web/src/components/layout/RsMobileTabBar.tsx`

**Interfaces:**
- Consumes: `rsMobileTabId`
- Props: `{ pathname: string; onLogout: () => void }`

- [ ] **Step 1: Render this structure**

```tsx
<nav className="rs-mobile-tabbar" aria-label="PTT CRM">
  <div className="rs-mobile-tabbar__tabs">
    {/* Link items, in this order */}
  </div>
  <button type="button" className="rs-mobile-tabbar__logout" onClick={onLogout}>
    Đăng xuất
  </button>
</nav>
```

| id | Label | href |
|----|-------|------|
| leads | Lead | `/crm/leads` |
| cskh | CSKH | `/crm/cskh-board` |
| chat | Chat | `/crm/csd/chat` |
| tickets | Ticket | `/crm/csd/tickets` |

Use `next/link`. Add `aria-current="page"` when `rsMobileTabId(pathname) === id`. Do not append a query string.

- [ ] **Step 2: Commit together with Task 3** after the shell actually mounts the bar. Do not commit the component alone if nothing imports it.

---

### Task 3: Mount the bar and hide the desktop chrome

**Files:**
- Modify: `services/ops-web/src/components/layout/StaffPageShell.tsx`
- Modify: `services/ops-web/src/app/globals.css`

`StaffPageShell` today always renders `OpsNav`, `SlaAlertToastHost`, `B2bHotAlarm`, and `CsdChatDock` unless `chrome="chat"`. On a phone those cover the page. The chat dock also duplicates the Chat tab.

- [ ] **Step 1: Track the phone flag in the shell**

`'use client'` is already on the file. Add state:

```tsx
const [phone, setPhone] = useState(false);
const pathname = usePathname();

useEffect(() => {
  const query = window.matchMedia('(max-width: 767px)');
  const read = () => {
    setPhone(showRsMobileChrome({ width: query.matches ? 767 : 768, search: window.location.search }));
  };
  read();
  query.addEventListener('change', read);
  window.addEventListener('popstate', read);
  return () => {
    query.removeEventListener('change', read);
    window.removeEventListener('popstate', read);
  };
}, [pathname]);
```

Use width `767` when the media query matches and `768` when it does not, so the boundary stays inside `showRsMobileChrome` and is unit-tested. Re-read on `pathname` because `shell=native` can appear after navigation.

Also set `document.documentElement.classList.toggle('rs-mobile-chrome', phone)` in that effect, and remove the class on cleanup.

- [ ] **Step 2: Branch the existing chrome**

When `phone` is true:

- Do not render `OpsNav`, `SlaAlertToastHost`, `B2bHotAlarm`, or `CsdChatDock`.
- Still render `CsdChatNotifyHost` when `user` is set, so an open tab can hear a new chat message.
- Render `RsMobileTabBar` with `pathname` and `onLogout`.
- Pass `breadcrumb={undefined}` into `OpsPage`. Keep `width`.

When `phone` is false, keep today's tree, including `chrome === 'chat'`.

`chrome === 'chat'` and `phone` can both be true on `/crm/csd/chat` in the installed lead PWA (`display-mode: standalone` makes the chat page pick chat chrome). In that case still show the tab bar and still hide the desktop nav. Do not show `CsdChatOnlyLoginForm`; that form is selected only by `shell=native` inside the chat page. Do not change `services/ops-web/src/app/crm/csd/chat/page.tsx` in this task.

- [ ] **Step 3: CSS**

Append to `globals.css`:

```css
.rs-mobile-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  padding: 0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.rs-mobile-tabbar__tabs {
  display: flex;
  flex: 1;
  min-width: 0;
}

.rs-mobile-tabbar__tabs a {
  flex: 1;
  text-align: center;
  padding: 0.45rem 0.15rem;
  font-size: 0.8rem;
}

.rs-mobile-tabbar__tabs a[aria-current='page'] {
  font-weight: 700;
}

.rs-mobile-tabbar__logout {
  border: 0;
  background: transparent;
  padding: 0.45rem 0.35rem;
  font-size: 0.75rem;
}

html.rs-mobile-chrome body:has(.ops-sidebar) main,
html.rs-mobile-chrome main {
  margin-left: 0 !important;
  padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)) !important;
}

html.rs-mobile-chrome .pwa-install-banner {
  bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px));
}

html.rs-mobile-chrome .csd-chat-page.is-shell .csd-chat-compose,
html.rs-mobile-chrome .csd-chat-compose {
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
}
```

The compose rule only adds safe area inside the page. The tab bar's own padding accounts for the home indicator. Do not add a second `4.5rem` onto the compose box or the send button sits too high. The `main` padding is what clears the bar.

- [ ] **Step 4: Check in the browser at 390×844 and at 1280×800**

390px, `/crm/leads`: four labels, Đăng xuất, no `.ops-sidebar`, no `#csd-chat-dock`.

1280px, same URL: sidebar is back, `.rs-mobile-tabbar` is absent.

390px, `/crm/csd/chat?shell=native`: `.rs-mobile-tabbar` is absent.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/layout/RsMobileTabBar.tsx services/ops-web/src/components/layout/StaffPageShell.tsx services/ops-web/src/app/globals.css
git commit -m "feat(crm): add the PTT CRM phone tab bar on the staff site"
```

---

### Task 4: Login stays the staff form

**Files:**
- Read only, unless the check fails: `services/ops-web/src/app/login/page.tsx`

- [ ] **Step 1: Open `/login` at 390×844**

The form has an email field and a password field. It has no field labeled `Tên đăng nhập chat`. Submitting still posts to the existing staff login. Do not add a second form.

- [ ] **Step 2: Open `/crm/leads` while logged out**

The redirect is `/login?next=` plus the encoded path, from `loginHrefWithNext`. After a successful login the app returns to that path. Do not change `services/ops-web/src/lib/auth/login-next.util.ts` if this already happens.

- [ ] **Step 3: Commit only if a layout overflow on `/login` blocks the submit button**

Message: `fix(crm): keep the staff login usable on a phone`.

---

### Task 5: Leads and CSKH

These screens already have a phone layout. This task only fixes a collision with the new bar.

| Route | Existing phone UI | File |
|-------|-------------------|------|
| `/crm/leads` | Card list under the narrow breakpoint, pull to refresh | `services/ops-web/src/components/crm/CrmLeadsList.tsx`, `services/ops-web/src/components/mobile/PullToRefresh.tsx` |
| `/crm/leads/[id]` | Tabs Chi tiết, Hoạt động, AI | `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| `/crm/cskh-board` | `win-cskh-mobile-card` | `services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx` |

- [ ] **Step 1: At 390×844, with a real staff session, open each route**

Confirm:

- Lead list is cards, not a sideways table. Pull to refresh still calls the list reload.
- Lead detail shows one tab at a time. The last button is not under `.rs-mobile-tabbar`.
- CSKH cards are readable. Do not add a KPI, a target, or a sample number.

- [ ] **Step 2: If the last action sits under the bar, add padding on that page only**

Do not change copy. Do not change the lead query.

- [ ] **Step 3: Commit a fix only when a screen failed Step 1**

---

### Task 6: Chat on the phone browser

**Files:**
- Read: `services/ops-web/src/app/crm/csd/chat/page.tsx`
- Modify only if the check fails: `services/ops-web/src/app/globals.css` (the block from Task 3)

- [ ] **Step 1: At 390×844 open `/crm/csd/chat` with no `shell` query**

Expected: staff session first. If chat is not unlocked, the form is `CsdChatLoginForm` (`data-testid="csd-chat-login"`), not `CsdChatOnlyLoginForm`. After the chat password, the thread and the send control are above the tab bar. The four tabs remain.

- [ ] **Step 2: Open `/crm/csd/chat?shell=native` at the same width**

Expected: no tab bar. The form is `CsdChatOnlyLoginForm` when there is no chat token. Do not change that page's native branch.

- [ ] **Step 3: Commit only a CSS fix that clears the send button**

Message: `fix(crm): keep the chat composer above the phone tab bar`.

---

### Task 7: Tickets as cards with column names

`CsdTicketList` renders a table inside `.data-table-wrap`. Under 960px, `globals.css` already turns a generic data table into stacked cards and hides `thead`. The cells have no `data-label`, so the card shows values without saying which is status or SLA.

**Files:**
- Modify: `services/ops-web/src/components/crm/csd/CsdTicketList.tsx`
- Modify: `services/ops-web/src/app/globals.css`
- Test: add a case to an existing ticket list spec if one exists. If none exists, create `services/ops-web/src/components/crm/csd/CsdTicketList.spec.tsx` only if the app already tests components with Testing Library. If it does not, skip the new spec file and check the DOM in the browser.

- [ ] **Step 1: Add `data-label` on each `td`, in header order**

Labels: `Mã`, `Tiêu đề`, `Ưu tiên`, `Trạng thái`, `SLA`, `Phụ trách`, `Cập nhật`.

- [ ] **Step 2: Show the label on the stacked card**

Inside the existing `@media (max-width: 960px)` card rule, add:

```css
.csd-ticket-table td[data-label]::before {
  content: attr(data-label);
  font-weight: 600;
  text-align: left;
}
```

Scope it to `.csd-ticket-table` so other tables do not change.

- [ ] **Step 3: At 390×844 open `/crm/csd/tickets` and one `/crm/csd/tickets/[id]`**

The list page does not scroll sideways. A row shows the code and the title. The ticket page's last action is above the tab bar. Empty state still says `Chưa có ticket Service Desk` when the account has no rows. Do not create a ticket for the screenshot.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(crm): label ticket fields on the phone card"
```

---

### Task 8: Browser pass before calling the work done

Use a real staff account. Do not create leads, tickets, or KPI rows.

- [ ] **Step 1: 390×844**

1. `/login` shows email and password.
2. `/crm/leads` shows the four tabs and Đăng xuất, and hides `.ops-sidebar`.
3. Open one existing lead, switch Chi tiết / Hoạt động / AI, go back. Filters that were in the URL are still there.
4. `/crm/cskh-board` and `/crm/csd/tickets` stay on the page while the session is valid.
5. `/crm/csd/chat` without `shell` shows `csd-chat-login` until the chat password is accepted.
6. `/crm/csd/chat?shell=native` has no `.rs-mobile-tabbar`.

- [ ] **Step 2: 1280×800**

`/crm/leads` shows `.ops-sidebar` and does not show `.rs-mobile-tabbar`.

- [ ] **Step 3: Run**

```bash
cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Confirm the store app was not touched**

`git diff --name-only` for this work has no `services/ptt-app/` and no `services/mobile-shell/`. `services/ops-web/src/app/manifest.ts` has no diff.

## Out of scope

App Store, Google Play, Capacitor for this site, lead push, ticket push, Portal, Meta, SEO, Email studio, KPI editors, and merging this layout into `services/ptt-app`.
