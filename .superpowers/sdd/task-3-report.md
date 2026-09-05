# Task 3 Report: Nest module + health / scope / money utils

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `bfc05ff2` — feat(am): add AmModule with 4-band health, scope, and money rules  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am.types.ts` | Created — unions, `ACTIVE_BOOK`, `DEFAULT_WEIGHTS` |
| `services/ptt-crm-api/src/am/am-health.util.ts` | Created — `bandFromScore`, `weightedScore`, `isActiveBook` |
| `services/ptt-crm-api/src/am/am-health.util.spec.ts` | Created — brief assertions |
| `services/ptt-crm-api/src/am/am-scope.util.ts` | Created — `resolveAmScope`, `amScopeSql` |
| `services/ptt-crm-api/src/am/am-scope.util.spec.ts` | Created — brief + SQL fragment cases |
| `services/ptt-crm-api/src/am/am-money.util.ts` | Created — `monthlyRecurringVnd`, `formatVnd` |
| `services/ptt-crm-api/src/am/am-money.util.spec.ts` | Created — brief assertions |
| `services/ptt-crm-api/src/am/am-freshness.util.ts` | Created — `workLeftLabel`, `isStale` |
| `services/ptt-crm-api/src/am/am-freshness.util.spec.ts` | Created — Task 10 / SRS work-hours cases |
| `services/ptt-crm-api/src/am/guards/staff-am.guard.ts` | Created — `StaffAmGuard`, `RequireAmAction`, `RequireAmFinanceAction` |
| `services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts` | Created — CSD-pattern + `view_all` + finance |
| `services/ptt-crm-api/src/am/am.module.ts` | Created — empty module, exports `StaffAmGuard` |
| `services/ptt-crm-api/src/app.module.ts` | Modified — `AmModule` import + imports array next to `CsdModule` |

**Not done (out of scope):** Dashboard API / `AmController` (Task 4).

## TDD evidence

Used local `./node_modules/.bin/jest` (29.7). Bare `npx jest` tried to install Jest 30 from npm and is not valid evidence.

### RED — Step 1: failing specs first

Wrote the five specs **before** any production `.ts` (except the specs themselves). Implementation files were absent.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-health.util.spec.ts src/am/am-scope.util.spec.ts \
  src/am/am-money.util.spec.ts src/am/am-freshness.util.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage

FAIL src/am/am-health.util.spec.ts
  TS2307: Cannot find module './am-health.util'
FAIL src/am/am-scope.util.spec.ts
  TS2307: Cannot find module './am-scope.util'
FAIL src/am/am-money.util.spec.ts
  TS2307: Cannot find module './am-money.util'
FAIL src/am/am-freshness.util.spec.ts
  TS2307: Cannot find module './am-freshness.util'
FAIL src/am/guards/staff-am.guard.spec.ts
  TS2307: Cannot find module './staff-am.guard'

Test Suites: 5 failed, 5 total
Tests:       0 total
```

Failure reason matches the brief: files/exports missing, not a typo.

### GREEN — Step 2–3: implement + pass

Implemented types, four utils (signatures verbatim), `StaffAmGuard` (CSD copy: section `crm_am`, metadata `amRequiredAction`), empty `AmModule`, registered in `app.module.ts`.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-health.util.spec.ts src/am/am-scope.util.spec.ts \
  src/am/am-money.util.spec.ts src/am/am-freshness.util.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage

PASS src/am/am-scope.util.spec.ts
PASS src/am/am-freshness.util.spec.ts
PASS src/am/am-money.util.spec.ts
PASS src/am/am-health.util.spec.ts
PASS src/am/guards/staff-am.guard.spec.ts

Test Suites: 5 passed, 5 total
Tests:       21 passed, 21 total
```

Jest printed `A worker process has failed to exit gracefully and has been force exited` after PASS (exit 0). Suites still passed.

Brief assertions that passed:

- `bandFromScore(80/79/59/39)` → healthy / watch / at_risk / critical
- `weightedScore(all 100)` → `100`
- `isActiveBook('churned')` false; `'paused'` true
- `monthlyRecurringVnd(media_spend|project)` null; `monthly` 20_000_000
- `formatVnd(null)` → `—`
- `resolveAmScope(all, no view_all)` → `me`; with `view_all` → `all`

## Behavior

- Health bands: ≥80 healthy, ≥60 watch, ≥40 at_risk, else critical. Weights 30/20/20/15/15.
- `ACTIVE_BOOK` = onboarding / active / at_risk / renewing / paused.
- Scope: `all` requires `hasViewAll`; `team` requires `canTeam || hasViewAll`; else `me`.
- `amScopeSql`: `all` → `TRUE`; empty team → owner only; team → `team_id = ANY` OR owner; `me` → owner OR open assigned task.
- Money: `media` / `media_spend` / `project` / `one_off` → null MRR; `annual` / `yearly` → `round(amount/12)`; else amount.
- Freshness: ICT Mon–Fri 08:30–17:30. Tue 09:30 → `Giờ LV còn 8h`. Saturday → `Ngoài giờ LV`. After hours weekday → `Giờ LV còn 0p`. `isStale` default 24h.
- Guard: internal key bypass; unresolved staff `am_unresolved_staff`; `view` also passes with `view_all`; finance metadata section `crm_am.finance`.

## Self-review

| Area | Assessment |
|------|------------|
| Signatures | Types and util functions match the brief verbatim |
| Module | Empty `AmModule` (guard only). No dashboard controller |
| Registration | `import { AmModule } from './am/am.module'` then `AmModule` beside `CsdModule` |
| Guard | CSD copy: `amRequiredAction`, section `crm_am`, `view` ∪ `view_all` |
| Finance | `RequireAmFinanceAction` + `amRequiredSection` for later finance routes |
| Scope SQL | Alias `e` = `crm_am_account_ext`; closed/cancelled tasks excluded from `me` |
| Commit | 13 files only. `.superpowers/` and `node_modules` not staged |
| Dashboard | Not implemented (Task 4) |

## Deviations from Brief

- Freshness function signatures are not in Task 3’s code block. Implemented `workLeftLabel` / `isStale` from Task 10 + SRS (`Giờ LV còn {XhYm}`, VN 08:30–17:30 T2–T6).
- Scope spec also asserts `amScopeSql` fragments (brief only listed two `resolveAmScope` expects).
- Guard spec adds `view_all`, finance section, and internal-key cases beyond the CSD template.
- `AM_REQUIRED_SECTION_KEY` is extra metadata so finance can use `crm_am.finance` without a second guard class.

## Concerns

- Stale threshold (24h) is not specified in the Task 3 brief; Task 4/10 may need a settings-driven threshold.
- Mixed hour+minute label (`Giờ LV còn 7h12`) is implemented but not unit-tested.
- Jest worker leak warning after PASS; exit code was still 0.
- `RequireAmFinanceAction` is unused until finance endpoints exist.
- `weightedScore` does not round; non-integer component mixes will float.

## Files Changed

```
services/ptt-crm-api/src/am/am.types.ts
services/ptt-crm-api/src/am/am-health.util.ts
services/ptt-crm-api/src/am/am-health.util.spec.ts
services/ptt-crm-api/src/am/am-scope.util.ts
services/ptt-crm-api/src/am/am-scope.util.spec.ts
services/ptt-crm-api/src/am/am-money.util.ts
services/ptt-crm-api/src/am/am-money.util.spec.ts
services/ptt-crm-api/src/am/am-freshness.util.ts
services/ptt-crm-api/src/am/am-freshness.util.spec.ts
services/ptt-crm-api/src/am/guards/staff-am.guard.ts
services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts
services/ptt-crm-api/src/am/am.module.ts
services/ptt-crm-api/src/app.module.ts
```
