# Task 4 Report: Dashboard API

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `0d322e28` — feat(am): add command-center API with 6 KPIs and 4-band health  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am.types.ts` | Modified — `AmRole`, `AmCommandCenter` (brief DTO verbatim) |
| `services/ptt-crm-api/src/am/am-dashboard.service.ts` | Created — `sumRevenueAtRisk`, `emptyKpis`, `showCoverage`, `AmDashboardService.get` |
| `services/ptt-crm-api/src/am/am-dashboard.service.spec.ts` | Created — in-memory KPI / coverage cases (no Postgres) |
| `services/ptt-crm-api/src/am/am-audit.repository.ts` | Created — insert into `crm_am_audit` |
| `services/ptt-crm-api/src/am/am.controller.ts` | Created — `GET /api/crm/am/command-center` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — controller + dashboard + audit providers |

**Not done (out of scope):** ops-web UI (Task 5). `.superpowers/` not committed.

## TDD evidence

Used local `./node_modules/.bin/jest` (worktree symlink to main `node_modules`).

### RED — Step 1: failing spec first

Wrote `am-dashboard.service.spec.ts` before `am-dashboard.service.ts` existed.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-dashboard.service.spec.ts --no-coverage

FAIL src/am/am-dashboard.service.spec.ts
  TS2307: Cannot find module './am-dashboard.service'

Test Suites: 1 failed, 1 total
Tests:       0 total
```

Failure reason matches the brief: module/exports missing, not a typo.

### GREEN — Step 2–4: implement + pass

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-dashboard.service.spec.ts --no-coverage

PASS src/am/am-dashboard.service.spec.ts
  ✓ counts revenue at risk only for at_risk ∪ critical
  ✓ returns null KPIs for empty book
  ✓ hides coverage unless team/all and director/admin

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Brief assertions that passed:

- `sumRevenueAtRisk([{watch:100},{at_risk:50},{critical:20},{healthy:80}])` → `{ vnd: 70, count: 2 }` (Watch excluded)
- `emptyKpis()` → `active_accounts`, `mrr_vnd`, `csat` null (also renewal / at-risk / sla null; no `deltas`)

## Behavior

- `GET /api/crm/am/command-center?from&to&scope=` behind `StaffOrInternalKeyGuard` + `StaffAmGuard` + `@RequireAmAction('view')`.
- Scope via `resolveAmScope` / `amScopeSql`. Role: `manage` → admin; `view_all` or `assign` → director; else am.
- `active_accounts` = ext `am_status IN ACTIVE_BOOK`. Empty book → every KPI `null`, arrays `[]`, no money `0`.
- `mrr_vnd` = Σ `monthlyRecurringVnd` of Active+Renewing contracts (media/project excluded).
- `renewal_90d_*` = Active contracts with `ends_on ∈ [to, to+90d]`. Count contracts.
- `revenue_at_risk_*` = latest snapshot band ∈ {at_risk, critical} only.
- `sla_overdue` = CSD `scope_status='in_scope' AND sla_status='breached'` joined to in-scope clients. Missing CSD table → `null`.
- `csat` = `null` (Wave 1). Previous period missing → omit `deltas`.
- `from`/`to` used for snapshot as-of (`to`), renewal window, health, book, forecast. `today_work` query ignores period.
- `coverage` only when resolved scope is `team`/`all` **and** role is director/admin.
- In-process cache 60s keyed by `staffId|scope|from|to`. `dropCache(key?)` for later write paths.
- One book SQL + latest-snapshot join + contracts JSON. Missing `crm_contracts` → retry without contracts (money KPIs stay `null`).

## Self-review

| Area | Assessment |
|------|------------|
| DTO | `AmCommandCenter` matches the brief verbatim in `am.types.ts` |
| Controller | Path, guards, `@RequireAmAction('view')`, `get(req, q)` match the brief |
| KPI rules | Watch excluded from at-risk; empty book nulls; CSAT null; no fake money 0 |
| Cache | 60s in-process; key includes staff/scope/period (NFR-001) |
| Module | Dashboard + audit + controller wired; `StaffAmGuard` still exported |
| Commit | 6 AM files only. `.superpowers/` and `node_modules` not staged |
| UI | Not implemented (Task 5) |

## Deviations from Brief

- Extra in-memory spec for `showCoverage` (team/all ∩ director/admin).
- Empty-KPI spec also asserts `renewal_90d_vnd`, `revenue_at_risk_vnd`, `sla_overdue`, omitted `deltas`.
- Forecast buckets from health-band MRR (no `crm_am_renewal_cases` in Wave 1 DDL).
- Deltas always omitted (no previous-period query yet).
- Snapshot filter uses `to` as as-of; `from` is echoed and part of the cache key.

## Concerns

- No integration test against real Postgres; CSD/contracts paths are SQL + `42P01` → `null` / fallback.
- `from` does not further filter the book beyond cache/period echo.
- Audit repo is wired but GET does not write (NFR-004 is for writes).
- Team IDs come from `staff_user_teams`; missing org tables → `[]` (team scope falls back to owner-only SQL).
- Forecast is a health-band proxy until renewal cases exist.

## Files Changed

```
services/ptt-crm-api/src/am/am.types.ts
services/ptt-crm-api/src/am/am-dashboard.service.ts
services/ptt-crm-api/src/am/am-dashboard.service.spec.ts
services/ptt-crm-api/src/am/am-audit.repository.ts
services/ptt-crm-api/src/am/am.controller.ts
services/ptt-crm-api/src/am/am.module.ts
```

## Review follow-up (Important)

**Commit:** `bbdbea46` — fix(am): null at-risk money and use ICT dates for today-work chips

Fixed two Important findings only. Forecast / `from` / CSD tenant (Minor) and UI left unchanged.

### RED — failing specs first

Added `at_risk` + `mrr: null` and `todayWorkChip` ICT-day cases before the helper existed / before money returned null.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-dashboard.service.spec.ts --no-coverage

FAIL src/am/am-dashboard.service.spec.ts
  TS2305: Module '"./am-dashboard.service"' has no exported member 'todayWorkChip'.

Test Suites: 1 failed, 1 total
Tests:       0 total
```

Pre-fix `sumRevenueAtRisk([{ band: 'at_risk', mrr: null }])` returned `{ vnd: 0, count: 1 }` (money 0). Chip used `toISOString().slice(0,10)` (UTC), so `2026-09-05T01:00:00+07:00` compared as `2026-09-04`.

### GREEN — after fix

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-dashboard.service.spec.ts --no-coverage

PASS src/am/am-dashboard.service.spec.ts
  ✓ counts revenue at risk only for at_risk ∪ critical
  ✓ sends null at-risk money when at_risk accounts have no recurring
  ✓ returns null KPIs for empty book
  ✓ hides coverage unless team/all and director/admin
  ✓ classifies today_work chip by Asia/Ho_Chi_Minh calendar day

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

- `sumRevenueAtRisk`: at-risk/critical with no recurring → `vnd: null`, count kept. Never money `0`.
- `todayWorkChip` extracted: compare `ictYmd(due)` to `ictYmd(now)` (`Asia/Ho_Chi_Minh`). Unassigned still wins.
