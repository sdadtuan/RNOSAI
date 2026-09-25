# PTT CRM mobile — Việc 1: quy tắc chrome điện thoại

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure function that says when the staff phone chrome is on, and which of the four tabs matches a path.

**Architecture:** Two functions in one module. No React, no CSS, no new route. Việc 2 becomes the tab bar that calls `rsMobileTabId`. Việc 3 becomes `StaffPageShell` calling `showRsMobileChrome`.

**Tech Stack:** Vitest in `services/ops-web`.

**Spec:** `docs/superpowers/specs/2026-09-25-rs-staff-mobile-srs.md` version 1.1, decisions M3 and M4.

**Parent plan:** `docs/superpowers/plans/2026-09-25-rs-staff-mobile.md` Task 1.

## Global Constraints

- Phone chrome is on when `width < 768` and the query does not select `shell=native` or `shell=desktop`.
- `768` and above is desktop.
- Do not add `shell=mobile`.
- Do not edit `StaffPageShell`, `globals.css`, the chat page, `manifest.ts`, `services/ptt-app`, or `services/mobile-shell` in this task.
- Do not add a bundle id or a Capacitor project.

## Files

| File | Action |
|------|--------|
| `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts` | Create first |
| `services/ops-web/src/lib/crm/rs-mobile-shell.ts` | Create second, to make the test pass |

## Interfaces this task produces

```ts
export type RsMobileTabId = 'leads' | 'cskh' | 'chat' | 'tickets';

export function showRsMobileChrome(input: { width: number; search: string }): boolean;

export function rsMobileTabId(pathname: string): RsMobileTabId | null;
```

`pathname` is the path only, without `?` or `#`. Callers strip the query before passing it.

---

- [ ] **Step 1: Write the failing test**

Create `services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts` with this exact content:

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
    expect(showRsMobileChrome({ width: 390, search: 'shell=desktop' })).toBe(false);
  });

  it('stays on for the lead PWA query on a phone', () => {
    expect(showRsMobileChrome({ width: 390, search: '?shell=pwa' })).toBe(true);
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
    expect(rsMobileTabId('/crm/csd/tickets-old')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts
```

Expected: FAIL because `./rs-mobile-shell` does not exist. Do not implement before this failure.

- [ ] **Step 3: Implement the module**

Create `services/ops-web/src/lib/crm/rs-mobile-shell.ts`:

```ts
export type RsMobileTabId = 'leads' | 'cskh' | 'chat' | 'tickets';

const TABS: ReadonlyArray<readonly [string, RsMobileTabId]> = [
  ['/crm/csd/tickets', 'tickets'],
  ['/crm/csd/chat', 'chat'],
  ['/crm/cskh-board', 'cskh'],
  ['/crm/leads', 'leads'],
];

export function showRsMobileChrome(input: { width: number; search: string }): boolean {
  if (input.width >= 768) return false;
  const raw = input.search.startsWith('?') ? input.search.slice(1) : input.search;
  const shell = new URLSearchParams(raw).get('shell');
  if (shell === 'native' || shell === 'desktop') return false;
  return true;
}

export function rsMobileTabId(pathname: string): RsMobileTabId | null {
  const path = pathname.split('?')[0].split('#')[0];
  for (const [prefix, id] of TABS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return id;
  }
  return null;
}
```

`URLSearchParams.get('shell')` returns the first value. `?shell=native&shell=mobile` is `native`, so the chrome stays off. A search without a leading `?` still parses.

Ticket and chat prefixes are listed before `/crm/leads` so a future shorter prefix cannot swallow them. The match is the path itself or `prefix + '/'`, so `/crm/leads-archive` is not Lead.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd services/ops-web && npx vitest run src/lib/crm/rs-mobile-shell.spec.ts
```

Expected: 2 files, all tests PASS. This command does not start the Next server.

- [ ] **Step 5: Commit only these two files**

```bash
git add services/ops-web/src/lib/crm/rs-mobile-shell.ts services/ops-web/src/lib/crm/rs-mobile-shell.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): decide when the PTT CRM phone chrome is on

EOF
)"
```

Do not commit `tsconfig.tsbuildinfo` or `docs/p11-verify/`.

## Done when

- The vitest command in Step 4 passes.
- `showRsMobileChrome({ width: 767, search: '' })` is true and `{ width: 768, search: '' }` is false.
- `shell=native` and `shell=desktop` force false even at width 390.
- `rsMobileTabId('/crm/leads/abc')` is `leads` and `rsMobileTabId('/crm/leads-archive')` is null.
- No UI is visible yet. The bar is Việc 2.

## Out of scope

Thanh bốn mục, CSS, ẩn menu desktop, đăng nhập, lead, CSKH, chat, ticket, deploy, App Store, Google Play.
