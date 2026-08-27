# Task 3 report — CRM Leads Legacy + consumers PostgreSQL cutover

## Status

Implemented Task 3.

- `CrmLeadsLegacyService` now reads and writes through `CrmLeadsPgRepository` only.
- `CrmLeadsLegacyModule` provides and exports only the PostgreSQL repository.
- Deal Room owner-name lookups and AI NBA activity lookups now use PostgreSQL.
- Removed `crm-leads-sqlite.repository.ts`.
- Migrated the deleted repository's remaining direct consumers to the PostgreSQL repository so the API continues to compile.
- Confirmed there are no `CrmLeadsSqliteRepository` or `crm-leads-sqlite.repository` references under `src`.

## Verification

- `npm run build`: PASS.
- Available Deal Room and NBA tests:
  - 5 suites passed.
  - 18 tests passed.
- Requested broad Jest selection:
  - 54 suites passed, 4 skipped, 2 failed.
  - 182 tests passed, 4 skipped, 2 failed.
  - The two failures are unrelated pre-existing test fixture drift:
    - `manager-coach.service.spec.ts` does not provide `LmpSciAnalyticsService`.
    - `orchestrator/agent.registry.spec.ts` constructs `AgentRegistry` without `BudgetRecommendService`.
- No CRM Leads Legacy service spec exists in the selected paths.

## Scope

No Intake cutover work was started.
# Task 3 Report: Cases PostgreSQL Cutover

**Status:** Complete  
**Branch:** `feat/wave1-sqlite-to-pg`  
**Commit:** `cc912eba` — `Serve CRM cases from PostgreSQL only.`

## Summary

- Added `CasesPgRepository` and ported every public method from `CasesSqliteRepository`.
- Wired `CasesService`, `CasesModule`, NBA event logging, and pipeline-risk event logging to the PostgreSQL-only path.
- Preserved the existing `CaseRow`, `CaseEventRow`, and `CareReportRow` API shapes, including ISO timestamp mapping.
- Added idempotent base-table DDL, additive pipeline columns, event/care-report tables, and indexes.

## Production Schema Check

Before writing DDL, queried `information_schema.columns` on `rs.pttads.vn`.

- Existing `crm_cases.id`, `customer_id`, and staff identifiers are `bigint`.
- Existing timestamps are `timestamp with time zone`.
- `pipeline_stage`, `stage_entered_at`, `lead_source`, and `deal_value_vnd` already exist.
- `campaign_id` is absent and is added idempotently by repository bootstrap.

## TDD

RED:

```text
FAIL src/cases/cases-pg.repository.spec.ts
TS2307: Cannot find module './cases-pg.repository'
```

GREEN:

```text
PASS src/cases/cases-pg.repository.spec.ts
4 tests passed
```

Coverage includes PG-only wiring, schema bootstrap, filtered listing and timestamp mapping, normalized patch/assignment parameters, and care-report staff fallback.

## Verification

```text
npm --prefix services/ptt-crm-api test -- --runInBand src/cases --no-coverage
1 suite passed, 4 tests passed

npm --prefix services/ptt-crm-api test -- --runInBand src/ai-intelligence/pipeline-risk.service.spec.ts --no-coverage
1 suite passed, 4 tests passed

npm --prefix services/ptt-crm-api run build
exit 0
```

`CasesSqliteRepository`, `DatabaseSync`, and `sqlitePath` have zero references in the Cases service/module.

## Concerns

- No live GET/POST smoke was run because this branch was not deployed to the VPS and no disposable production case/customer was authorized.
- The legacy `cases-sqlite.repository.ts` remains in the tree but is no longer wired; the playbook defers deletion until a successful VPS smoke.
- Test commands emit the existing npm warning for the unsupported `devdir` config; it does not affect results.

## Follow-up: Care Report List Limit

**Finding:** `listCareReports` in `cases-pg.repository.ts` capped `limit` at 200 via `Math.max(1, Math.min(Number(limit) || 50, 200))`, but `cases-sqlite.repository.ts` passes `limit` through unchanged.

**Fix:** Removed the PG cap so `limit` is forwarded to the query exactly as in SQLite.

**Verification:**

```text
cd services/ptt-crm-api && npx jest src/cases --no-coverage
1 suite passed, 4 tests passed
```
