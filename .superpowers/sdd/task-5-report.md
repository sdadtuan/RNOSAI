# Task 5 Report: AmShell + Dashboard UI + placeholders

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `8a9afc11` — feat(am): add AmShell and Wave 1 dashboard matching UI-AM-01  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ops-web/src/lib/crm/am-api.ts` | Created — `AmCommandCenter` + `fetchAmCommandCenter` (staff Bearer, CSD pattern) |
| `services/ops-web/src/lib/crm/am-format.ts` | Created — `dash`, `bandCopy`, `vnd` (null → —) |
| `services/ops-web/src/lib/crm/am-format.spec.ts` | Created — dash/bandCopy first (TDD) |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Created — `am-root` div (no second `<main>`), grouped `AM_NAV`, scope/density/collapse, role label |
| `services/ops-web/src/components/crm/am/AmCreateMenu.tsx` | Created — Khách/Việc/Renewal/Plan if edit; Cơ hội/Log disabled + Wave tooltips |
| `services/ops-web/src/components/crm/am/AmDashboard.tsx` | Created — 6 KPI tiles, widgets + Retry, empty copy, coverage when API sends it |
| `services/ops-web/src/components/crm/am/AmPlaceholder.tsx` | Created — `{title} — mở ở Wave n` |
| `services/ops-web/src/app/crm/account-management/am.css` | Created — `am-*` tokens Navy/Accent/Success/Warning/Danger/Info, radius 10–12 |
| `services/ops-web/src/app/crm/account-management/layout.tsx` | Created — `<AmShell>{children}</AmShell>` |
| Pages | Created — dashboard + clients/onboarding/work/renewals/contracts/reports/health/settings/feedback/opportunities (and `[id]` where listed) |
| `services/ops-web/src/components/OpsNav.tsx` | Modified — TITLE_MAP + Account Management section **after Service Desk** |
| `services/ops-web/src/components/layout/nav-icons.tsx` | Modified — section/link icons for AM |

**Not done (out of scope):** create drawers (Tasks 6–7), ⌘K (Task 8), claim-work API. `.superpowers/` not committed.

## TDD evidence

### RED — Step 1: format spec first

Wrote `am-format.spec.ts` before `am-format.ts` existed.

```
$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-format.spec.ts

FAIL  src/lib/crm/am-format.spec.ts
Error: Cannot find module './am-format'
```

Failure reason matches the brief: module/exports missing, not a typo.

### GREEN — implement + pass

```
$ cd services/ops-web && npx vitest run src/lib/crm/am-format.spec.ts src/lib/crm/am-nav.util.spec.ts

PASS  src/lib/crm/am-format.spec.ts (5)
PASS  src/lib/crm/am-nav.util.spec.ts (5)

Test Files  2 passed (2)
     Tests  10 passed (10)
```

Brief assertions: `dash(null)==='—'`, `bandCopy('watch')==='Cần theo dõi'`.

## Behavior

- `/crm/account-management` renders UI-AM-01 via `GET /api/crm/am/command-center?scope=`.
- AmShell uses `<div className="am-root">` inside Ops `<main>` (StaffPageShell / OpsPage). No nested `<main>`.
- Sidebar: grouped `AM_NAV` (8 items). **No count badges.**
- Role label from caps: Admin if `manage`, Director if `view_all`, else AM — text, not a dropdown.
- Scope query `?scope=me|team|all` (default `me`). Density `localStorage.am-density`. Collapse `localStorage.am-sidebar-collapsed`.
- Exactly 6 KPI tiles: Khách hàng active · MRR hiện tại · Gia hạn 90 ngày · Revenue at risk · SLA quá hạn · CSAT. Clicks: clients / clients?sort=mrr / renewals?window=90 / health?band=at_risk,critical / work?sla=breached / feedback (scope appended).
- Null KPI → `—`. No hard-coded 48 / 1,28 tỷ / 1.248.
- Widget error: keep height + Retry. Empty today-work: `Bạn đã xử lý xong các việc ưu tiên hôm nay.` Empty book + `edit`: CTA Tạo khách.
- Create menu: Khách · Việc · Renewal/Plan enabled if `edit` (empty drawer stub). Cơ hội tooltip `Mở ở Wave 4`. Log tương tác tooltip `Mở ở Wave 3`.
- Placeholders: title + `mở ở Wave n` per SRS §5.2 — never 404.
- Search box is a no-op (⌘K is Task 8). Nhận xử lý / Tạo khách alert/stub (Tasks 6–7).

## Self-review

| Area | Assessment |
|------|------------|
| Nested `<main>` | None in AmShell / AM pages. Page column is `am-root` + `am-column` |
| Mock numbers | None. `dash`/`vnd` only; API null stays `—` |
| Nav badges | `AM_NAV` has no `badge`; sidebar links are label-only |
| OpsNav | After Service Desk, not under KPI Hub |
| Create / ⌘K | Stubs only, as briefed |

## Concerns

- Widget Retry shares one command-center fetch (not independent per-widget APIs).
- Create drawers and claim-work are stubs until Tasks 6–7.
- Search does not query (Task 8).
- Settings placeholder uses Wave 2 (first open); field/SLA remains Wave 4 in SRS.
- UI not exercised in a browser this task.

## Review fix: hide empty copy while loading

**Issue:** AmDashboard showed empty-state copy (`Bạn đã xử lý xong…`, `Tạo khách`) while command-center was still loading because `loading` from `useAmPage` was ignored.

**Fix:**
- Added `am-dashboard.util.ts` — `isAmDashboardLoading(loading, data)` and `shouldShowEmptyWidget(loading, error, items)`.
- `AmDashboard` reads `loading`; today-work, attention, and book widgets show `Đang tải…` when `loading && !data`, empty copy only when `!loading && !error && items.length === 0`.

**Tests:**

```
$ cd services/ops-web && npx vitest run src/lib/crm/am-format.spec.ts src/lib/crm/am-nav.util.spec.ts src/lib/crm/am-dashboard.util.spec.ts

PASS  src/lib/crm/am-format.spec.ts (5)
PASS  src/lib/crm/am-dashboard.util.spec.ts (3)
PASS  src/lib/crm/am-nav.util.spec.ts (5)

Test Files  3 passed (3)
     Tests  13 passed (13)
```

**Commit:** `fca2ec56` — fix(am): hide dashboard empty copy while command-center loads

## Review fix: loading during retry

**Issue:** `retry`/`loadCenter` cleared error but left `loading=false`, so widgets showed empty-success copy during in-flight retry after a failed fetch.

**Fix:**
- `loadCenter` sets `loading=true` at start and `loading=false` in `finally` (covers retry and scope refetch).
- Added util spec documenting retry-after-error must hide empty copy while loading.

**Tests:**

```
$ cd services/ops-web && npx vitest run src/lib/crm/am-format.spec.ts src/lib/crm/am-nav.util.spec.ts src/lib/crm/am-dashboard.util.spec.ts

PASS  src/lib/crm/am-dashboard.util.spec.ts (4)
PASS  src/lib/crm/am-format.spec.ts (5)
PASS  src/lib/crm/am-nav.util.spec.ts (5)

Test Files  3 passed (3)
     Tests  14 passed (14)
```

**Commit:** `30fe2b72` — fix(am): set dashboard loading during command-center retry
