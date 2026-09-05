# Task 11 Report: Wave 1 UAT (local evidence only)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** none this task (local suite green; no Critical AM regression)  
**Date:** 2026-09-05

## Scope

Local UAT only. **Did not** deploy to VPS / `https://rs.pttads.vn`. **Did not** grant prod RBAC. Those steps stay **BLOCKED pending PO**.

No new `scripts/deploy_am_w1_vps.sh`. Existing reuse (not run): `scripts/deploy_ops_web.sh` for `ops-web`; existing Nest `deploy_*_vps.sh` pattern for `ptt-crm-api` restart; DDL at `docs/specs/2026-09-05-postgresql-ddl-am.sql`.

## Local commands

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/am --no-coverage
# Test Suites: 12 passed, 12 total
# Tests:       46 passed, 46 total
# (worker open-handle warning only — not a failure)

cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/auth.spec.ts \
  src/lib/crm/am-format.spec.ts \
  src/lib/crm/am-nav.util.spec.ts \
  src/lib/crm/am-dashboard.util.spec.ts \
  src/lib/crm/am-notify.util.spec.ts
# Test Files  5 passed (5)
# Tests       34 passed (34)
```

**Counts:** Jest 46 + Vitest 34 = **80 passed**. No code fix required.

## Static gates

| Check | Result |
|-------|--------|
| AM UI hardcoded `48` / `1,28 tỷ` / `1.248` | **none** (only `248px` sidebar width in `am.css`, not a KPI) |
| AM components / `account-management` `<main>` | **none** (single `<main>` stays in `OpsPage` via `StaffPageShell`) |
| Routes under `src/app/crm/account-management` | **present:** `clients`, `onboarding`, `work`, `renewals`, `reports`, `health`, `settings`, `feedback`, `opportunities` (+ dashboard + detail stubs) |
| RBAC prefix `/crm/account-management` | **present** in `rbac-routes.ts` (`crm_am.view` ∨ `view_all`) |
| OpsNav Account Management section | **present** when `canSeeAmNav` (`crm_am.view` ∨ `view_all`) |

## 12-item UAT checklist

| # | Item | Result | Local evidence |
|---|------|--------|----------------|
| 1 | User without cap → 403 on `/crm/account-management` | **PASS** | `auth.spec.ts`: agency-only `canAccessPath` false; `AmShell` redirects `/403`; `StaffAmGuard` fail-closed. Live browser 403 on VPS **BLOCKED**. |
| 2 | `view` sees OpsNav + Dashboard; KPI is `—` or live — never 48 / 1,28 tỷ | **PASS** | `canSeeAmNav` + OpsNav section; `kpiValue` returns `—` without data; grep has no mock KPIs. Live staff render **BLOCKED**. |
| 3 | Exactly 6 tiles + today work + attention + forecast + 4-band donut + my book | **PASS** | `AmDashboard` `KPI_TILES` length 6; widgets: hàng đợi, account cần chú ý, renewal forecast, phân bố health (4 bands), sổ khách. |
| 4 | Period change does not change today-work rows | **PASS** | `loadTodayWork(staffId, scope, teamIds, now)` — no `period`. Book/KPIs use `period.to`; UI Wave 1 fetch passes `scope` only. |
| 5 | Scope `me` hides others; `all` needs `view_all` | **PASS** | `resolveAmScope` downgrades `all` without `view_all` to `me`; AmShell hides Team/Toàn bộ unless `view_all`/`manage`. |
| 6 | Nhận xử lý assigns current user; refresh keeps it | **PASS** | `am-tasks.service.spec`: accept → `assignee_staff_id` = current staff, status `in_progress`, audit `task.accept`. Live click/refresh **BLOCKED**. |
| 7 | Tạo khách appears in `clients` + `crm_am_account_ext`; `/agency/clients/{id}` opens | **PASS** | `AmAccountsService` → `AgencyService.createClient` + UPSERT `crm_am_account_ext`. UI refreshes my_book; fallback link `/agency/clients/new`. Live open of `/agency/clients/{id}` **BLOCKED**. |
| 8 | Renewal plan without contract is blocked | **PASS** | `am-plans.service.spec`: missing / `0` / `""` / `"0"` → 400 `{ error: 'contract_required' }`. |
| 9 | ⌘K does not leak out-of-scope accounts | **PASS** | `AmPalette` sends current `scope`; `AmSearchService` applies `amScopeSql`; view user requesting `all` stays `me`. Live palette **BLOCKED**. |
| 10 | All child routes render placeholder, not 404 | **PASS** | Every listed child + detail stubs render `AmPlaceholder` (Wave 2/3/4 copy). |
| 11 | No nested `<main>`; KPI Hub layout unchanged | **PASS** | No `<main>` under AM components or `account-management` pages. `crm/kpi/page.tsx` still uses `DashboardShell` / its own `<main>` — not touched. |
| 12 | Sidebar has no numeric badges | **PASS** | `AM_NAV` spec: no `badge` field; `AmShell` sidebar has no badge markup. |

**Summary:** 12 PASS (local). 0 FAIL. Prod smoke + VPS DDL/rebuild/RBAC grant = **BLOCKED pending PO** (expected).

## Brief steps

- [x] **Step 1:** Local UAT against the 12 items (this report).
- [ ] **Step 2:** Apply DDL on VPS, rebuild `ops-web` + `ptt-crm-api`, grant `crm_am` to 1 AM + 1 Director via Admin RBAC — **BLOCKED pending PO**.
- [ ] **Step 3:** Prod smoke on `https://rs.pttads.vn` — **BLOCKED pending PO**. Stop here until PO signs Wave 1.

## Concerns

- Jest printed “worker process has failed to exit gracefully” after 46/46 pass — leak/timer, not a regression.
- Create-client UI does not navigate to `/agency/clients/{id}`; it retries the command center. Agency 360 still exists as a separate route.
- Wave 1 child pages are placeholders by design; list/360/handover start in Wave 2.
- No live staff session was used. Items 1, 2, 6, 7, 9 are unit/static PASS; browser confirmation waits on PO + RBAC.

## Next

PO unblocks Step 2 using existing deploy scripts + `docs/specs/2026-09-05-postgresql-ddl-am.sql`, then Step 3 prod smoke. Do not start Wave 2 until PO signs Wave 1.
