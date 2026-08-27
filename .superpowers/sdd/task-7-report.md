# Task 7 Report — Marketing plans PostgreSQL cutover

## Status

Completed Task 7 only. Marketing plans and the Market Research plan-insight attachment path now use `MarketingPlansPgRepository`; request-path wiring no longer imports the SQLite repository.

## Changes

- Added `marketing-plans-pg.repository.ts` with PostgreSQL schema bootstrap and the existing public repository contract:
  - `listPlans`
  - `getPlanById`
  - `listMilestones`
  - `listCampaigns`
  - `createPlan`
  - `patchPlan`
- Preserved marketing-plan API row mapping, labels, JSON strings, owner names, and aggregate campaign/milestone counts.
- Wired `MarketingPlansService`, `MarketingPlansModule`, and `MarketResearchService` to PostgreSQL only.
- Added repository and hard-cutover wiring tests.

## Verification

- `npx jest src/marketing-plans src/market-research --no-coverage`
  - PASS — 53 suites, 435 tests.
- `npm run build`
  - PASS.
- SQLite wiring grep across the modified service/module paths
  - 0 matches.
- Live VPS smoke was not run from this local task session.

## Scope

No Task 8 files were changed.
# Task 7 Report: Footer sidebar — Cài đặt

**Branch:** `feat/canopy-vivid-design`  
**Status:** Complete  
**Commits:** None (per instructions)

## Summary

Expanded sidebar footer now has **Cài đặt** (navigates to `/admin`) immediately before the existing collapse toggle. Collapsed rail still shows only the toggle. Hamburger brand and glass groups were not changed. Icons stay `currentColor` (no extra color).

## Step evidence

### Step 1 — footer was toggle-only

```bash
rg "Cài đặt" services/ops-web/src/components/OpsNav.tsx
```

Before: no match.

### Step 2 — no unit test

Per brief: nav chrome is visual + grep only. No spec added.

### Step 3 — implementation

File: `services/ops-web/src/components/OpsNav.tsx` (`.ops-sidebar-footer` only).

- Guard: `sidebarExpanded` — hidden when collapsed.
- Inserted **before** the existing `ops-sidebar-toggle`.
- `onClick={() => navigateTo('/admin')}`.
- Label verbatim: `Cài đặt`.
- `iconForHref('/admin')` is unmapped (`LINK_ICONS` → `'dot'`), so `NavIcon name="settings"` (existing gear in `nav-icons.tsx`).
- Not added to any `ops-nav-group--boxed` glass group.
- Brand hamburger (`ops-sidebar-burger` / PTT CRM) unchanged.

### Step 4 — typecheck

Brief command `npx tsc` resolved the wrong npm package (`tsc@2.0.4`). Used local compiler:

```bash
cd services/ops-web && ./node_modules/.bin/tsc --noEmit --pretty false
```

Pre-existing errors only (specs / e2e). **No errors from `OpsNav.tsx`.** Linter clean on the touched file.

### Step 5 — commit

Skipped (user: do not git commit / add / push).

## Self-review

| Check | Verdict |
|-------|---------|
| Cài đặt only when `sidebarExpanded` | ✓ |
| Placed before collapse toggle | ✓ |
| Toggle kept (`«` / `»`, same aria/title) | ✓ |
| Navigates to `/admin` via existing `navigateTo` | ✓ |
| Gear icon, no icon color override | ✓ |
| Not inside a glass group | ✓ |
| Hamburger brand untouched | ✓ |
| Only `OpsNav.tsx` changed | ✓ (+12) |

## Concerns / follow-ups

1. **Footer layout** — `.ops-sidebar-footer` is `display: flex; justify-content: center` (row). When expanded, Cài đặt and the toggle sit **side-by-side**. Demo footer is Cài đặt alone. No CSS added (out of file scope).
2. **Mobile** — `@media (max-width: 960px)` already sets `.ops-sidebar-footer { display: none }`. Cài đặt is unavailable on that breakpoint (pre-existing).
3. **No `is-active`** on `/admin` — brief snippet did not include it.
4. **`LINK_ICONS['/admin']` still missing** — other callers of `iconForHref('/admin')` still get `dot`. Mapping was not added (`nav-icons.tsx` not in modify list).

## Diff stat

```
 services/ops-web/src/components/OpsNav.tsx | 12 ++++++++++++
 1 file changed, 12 insertions(+)
```

## Review fix — sidebar SVG stroke-width (1.65)

**Finding:** NavIcon SVGs in `nav-icons.tsx` use `strokeWidth="1.75"`; global constraint requires **1.65**. Plan file map: do **not** modify `nav-icons.tsx` stroke.

**Change:** CSS overlay only in `services/ops-web/src/app/bitrix-theme.css` (under `html.ops-shell-bitrix` sidebar section):

```css
html.ops-shell-bitrix .ops-sidebar svg {
  stroke-width: 1.65;
}
```

`nav-icons.tsx` and `OpsNav.tsx` were **not** edited.

### Covering checks

```bash
rg -n "stroke-width: 1.65" services/ops-web/src/app/bitrix-theme.css
```

```
75:  stroke-width: 1.65;
```

```bash
cd services/ops-web && ./node_modules/.bin/tsc --noEmit --pretty false 2>&1 | rg "OpsNav" || true
```

```
(no output — no OpsNav type errors)
```
