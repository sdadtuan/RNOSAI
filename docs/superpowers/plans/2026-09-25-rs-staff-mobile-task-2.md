# PTT CRM mobile — Việc 2: thanh bốn mục

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the PTT CRM bottom bar component: Lead, CSKH, Chat, Ticket, and a Đăng xuất button.

**Architecture:** The tab list lives next to `rsMobileTabId` so Vitest can lock the order and the hrefs without rendering React. `RsMobileTabBar` only draws that list. Việc 3 mounts it in `StaffPageShell` and adds the CSS. This task does not show the bar on a page.

**Tech Stack:** Next.js `Link`, Vitest in `services/ops-web`.

**Spec:** `docs/superpowers/specs/2026-09-25-rs-staff-mobile-srs.md` version 1.1, FR-10 and FR-11.

**Parent plan:** `docs/superpowers/plans/2026-09-25-rs-staff-mobile.md` Task 2.

**Depends on:** Việc 1, `rsMobileTabId` in `services/ops-web/src/lib/crm/rs-mobile-shell.ts`. If that file is missing, implement `docs/superpowers/plans/2026-09-25-rs-staff-mobile-task-1.md` first.

## Global Constraints

- Labels and order are Lead, CSKH, Chat, Ticket. Đăng xuất is a button, not a fifth tab.
- Hrefs are `/crm/leads`, `/crm/cskh-board`, `/crm/csd/chat`, `/crm/csd/tickets`. Do not append `shell=` or any other query.
- Active tab uses `aria-current="page"` when `rsMobileTabId(pathname)` matches. `/crm/leads/abc` is Lead. `/crm/leads-archive` is none.
- Do not edit `StaffPageShell.tsx`, `globals.css`, the chat page, `manifest.ts`, `services/ptt-app`, or `services/mobile-shell`.
- Do not add a Capacitor project or a bundle id.

## Files

| File | Action |
|------|--------|
| `services/ops-web/src/lib/crm/rs-mobile-shell.ts` | Export the tab list |
| `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts` | Assert order, labels, hrefs |
| `services/ops-web/src/components/layout/RsMobileTabBar.tsx` | Create the bar |

## Interface this task produces

```ts
export const RS_MOBILE_TABS: ReadonlyArray<{
  id: RsMobileTabId;
  label: string;
  href: string;
}>;

export function RsMobileTabBar(props: { pathname: string; onLogout: () => void }): JSX.Element;
```

`rsMobileTabId` must keep using the same hrefs as `RS_MOBILE_TABS`. Build `TABS` inside `rsMobileTabId` from `RS_MOBILE_TABS` so the two cannot drift.

---

- [ ] **Step 1: Extend the failing test**

Add this describe block to `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts`. Import `RS_MOBILE_TABS` from `./rs-mobile-shell`.

```ts
describe('RS_MOBILE_TABS', () => {
  it('lists Lead, CSKH, Chat, Ticket in that order', () => {
    expect(RS_MOBILE_TABS.map((tab) => tab.label)).toEqual(['Lead', 'CSKH', 'Chat', 'Ticket']);
    expect(RS_MOBILE_TABS.map((tab) => tab.href)).toEqual([
      '/crm/leads',
      '/crm/cskh-board',
      '/crm/csd/chat',
      '/crm/csd/tickets',
    ]);
    expect(RS_MOBILE_TABS.map((tab) => tab.id)).toEqual(['leads', 'cskh', 'chat', 'tickets']);
  });

  it('uses the same hrefs as rsMobileTabId', () => {
    for (const tab of RS_MOBILE_TABS) {
      expect(rsMobileTabId(tab.href)).toBe(tab.id);
      expect(rsMobileTabId(`${tab.href}/abc`)).toBe(tab.id);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm the new block fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts
```

Expected: FAIL because `RS_MOBILE_TABS` is not exported. The Việc 1 tests still pass.

- [ ] **Step 3: Export the tab list from the shell module**

In `services/ops-web/src/lib/crm/rs-mobile-shell.ts`, replace the private `TABS` array with:

```ts
export const RS_MOBILE_TABS: ReadonlyArray<{
  id: RsMobileTabId;
  label: string;
  href: string;
}> = [
  { id: 'leads', label: 'Lead', href: '/crm/leads' },
  { id: 'cskh', label: 'CSKH', href: '/crm/cskh-board' },
  { id: 'chat', label: 'Chat', href: '/crm/csd/chat' },
  { id: 'tickets', label: 'Ticket', href: '/crm/csd/tickets' },
];
```

`rsMobileTabId` iterates `RS_MOBILE_TABS` with tickets and chat checked by path length, not by array order. Sort a copy by `href.length` descending before matching, so `/crm/csd/tickets` still wins over any shorter prefix that might be added later:

```ts
const byLength = [...RS_MOBILE_TABS].sort((a, b) => b.href.length - a.href.length);

export function rsMobileTabId(pathname: string): RsMobileTabId | null {
  const path = pathname.split('?')[0].split('#')[0];
  for (const tab of byLength) {
    if (path === tab.href || path.startsWith(`${tab.href}/`)) return tab.id;
  }
  return null;
}
```

Do not change `showRsMobileChrome`.

- [ ] **Step 4: Run the shell test and confirm it passes**

```bash
cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts
```

Expected: PASS, including the Việc 1 cases.

- [ ] **Step 5: Add the component**

Create `services/ops-web/src/components/layout/RsMobileTabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { RS_MOBILE_TABS, rsMobileTabId } from '@/lib/crm/rs-mobile-shell';

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
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <button type="button" className="rs-mobile-tabbar__logout" onClick={onLogout}>
        Đăng xuất
      </button>
    </nav>
  );
}
```

`href` is the path only. Do not read `window.location.search`. Do not import this component from `StaffPageShell` in this task.

- [ ] **Step 6: Commit the three files**

```bash
git add services/ops-web/src/lib/crm/rs-mobile-shell.ts services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts services/ops-web/src/components/layout/RsMobileTabBar.tsx
git commit -m "$(cat <<'EOF'
feat(crm): add the PTT CRM phone tab bar

EOF
)"
```

Do not commit `tsconfig.tsbuildinfo` or `docs/p11-verify/`.

## Done when

- `npx vitest run src/lib/crm/rs-mobile-shell.spec.ts` passes.
- `RS_MOBILE_TABS` labels are `Lead`, `CSKH`, `Chat`, `Ticket` in that order.
- Each href matches `rsMobileTabId`, including a child path `${href}/abc`.
- `RsMobileTabBar` sets `aria-current="page"` from `rsMobileTabId(pathname)` and calls `onLogout` from the Đăng xuất button.
- The bar is not on any page yet. Mounting it and hiding the desktop menu is Việc 3.

## Out of scope

`StaffPageShell`, CSS, safe area, ẩn `OpsNav`, đăng nhập, sửa lead, CSKH, chat, ticket, deploy, App Store, Google Play.
