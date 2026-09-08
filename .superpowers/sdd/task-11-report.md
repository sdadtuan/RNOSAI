# Task 11 report: QtShell, routes, OpsNav, rbac-routes

## Status

Done. Wave 1 ops-web shell expands `/crm/proposals*` with a 7-item `qt-*` sidebar, RBAC prefix, and placeholder chrome.

## TDD

### RED

`npm run test:unit -- src/lib/crm/qt-nav.util.spec.ts src/lib/crm/qt-format.spec.ts src/lib/auth.spec.ts` from `services/ops-web`:

- `qt-nav.util.spec.ts` — `Cannot find module './qt-nav.util'`
- `qt-format.spec.ts` — `Cannot find module './qt-format'`
- `auth.spec.ts` — `/crm/proposals` with `crm_quote.view` expected `true`, received `false` (matched `/crm` prefix only)

### GREEN

Same command after implementation:

```
✓ src/lib/crm/qt-format.spec.ts (3 tests)
✓ src/lib/crm/qt-nav.util.spec.ts (3 tests)
✓ src/lib/auth.spec.ts (22 tests)
Test Files  3 passed (3)
Tests  28 passed (28)
```

Assertions:

- `QT_NAV` length 7; ids/labels/hrefs match the locked sidebar; no Studio id/label/href
- `canSeeQtNav` true for `crm_quote.view`, `crm_quote.view_all`, `crm_board.view`; false for unrelated
- `dash(null) === '—'`; empty string and `undefined` also `—`; `0` preserved
- `/crm/proposals` true with `crm_quote.view`; false with `crm_leads.view`

## Manual rg

```
rg "Nhảy màn|Toàn catalog|NOVA" services/ops-web/src/components/crm/qt services/ops-web/src/app/crm/proposals
```

Empty (exit 1, no matches, including comments).

## What shipped

- `QtShell` + `qt.css`: OpsNav chrome, 7-item sidebar, scope, one `<main class="qt-main">`
- Placeholder routes: list, new, `[id]`, `[id]/studio`, `[id]/convert`, catalog, approvals, reports, settings, activity — titles + `—`
- `page.tsx`: `?id=` → `/crm/proposals/{id}`; `wizard=1` → `/crm/proposals/new` keeping `lead_id` and `customer_id`
- OpsNav user-visible quote entry: **Báo giá** (href `/crm/proposals`); shown when `canSeeQtNav`
- `rbac-routes.ts`: `/crm/proposals` rule inserted immediately before `/crm` (verbatim `anyOf`)
- `qtFetch` → `${API_BASE}/api/crm/proposals/*` with staff Bearer JWT
- `ProposalsContent.tsx` left in place unused

## Concerns

- Be Vietnam Pro is referenced in `qt.css` the same way as CP; the app still does not load that webfont globally.
- `QtShell` does not wrap `StaffPageShell` so `OpsPage` cannot add a second `<main>`.
- Overview UI is still placeholder (Task 12). Browser click-through was not run in this task.

## Review fixes (Task 11)

### Critical — nested `<main>` vs OpsNav host

`QtShell` now wraps `StaffPageShell` (same as `CpShell`). Inner pane is `<div className="qt-main">`, not a second `<main>`. Host `body:has(.ops-sidebar) main` margin/padding applies to the single OpsPage `<main>`.

### Important — Deal Room / Consult query

Extracted `qtOverviewRedirect`:

- `?id=` wins → `/crm/proposals/{id}`
- `wizard=1` **or** `lead_id` (and no builder `id`) → `/crm/proposals/new` with incoming params copied, `wizard` and `id` dropped only
- Keeps `lead_id`, `customer_id`, `service_slugs`, `notes`, `prefill_dv`, and any other keys

### Tests (GREEN)

`npm run test:unit -- src/lib/crm/qt-nav.util.spec.ts src/lib/crm/qt-format.spec.ts src/lib/auth.spec.ts src/lib/crm/qt-redirect.spec.ts` from `services/ops-web`:

```
✓ src/lib/crm/qt-format.spec.ts (3 tests)
✓ src/lib/crm/qt-redirect.spec.ts (4 tests)
✓ src/lib/crm/qt-nav.util.spec.ts (3 tests)
✓ src/lib/auth.spec.ts (22 tests)
Test Files  4 passed (4)
Tests  32 passed (32)
```

Redirect assertions: `id` wins; `wizard=1` forwards live fields and drops only `wizard`/`id`; `lead_id` without `wizard` → NEW-01; no id/wizard/lead_id stays on overview.

### Manual rg

```
rg "Nhảy màn|Toàn catalog|NOVA" services/ops-web/src/components/crm/qt services/ops-web/src/app/crm/proposals
```

Empty (no matches). Still 7 nav items, no Studio in nav, `dash(null)==='—'`, rbac `/crm/proposals` rule, OpsNav **Báo giá**.

### Remaining concerns

- Overview UI is still placeholder (Task 12). Browser click-through was not run in this fix.
