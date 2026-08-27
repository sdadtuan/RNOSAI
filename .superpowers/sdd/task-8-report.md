# Task 8 report — KPI PostgreSQL-only cutover

## Status

Implemented Wave 2 Task 8 only.

- `KpiService` now delegates KPI reads and writes exclusively to `KpiPgRepository`.
- Removed the SQLite repository injection and all `crmKpiPg` runtime branches from the KPI service.
- `KpiModule` now provides the PostgreSQL KPI repository only.
- Deleted `kpi-sqlite.repository.ts`.
- Added a service test covering PostgreSQL-only KPI read and write delegation.
- Task 9 was not started.

## Verification

- `npm --prefix services/ptt-crm-api test -- --runInBand src/kpi`
  - 1 suite passed.
  - 1 test passed.
- `npm --prefix services/ptt-crm-api run build`
  - Passed.

## Smoke coverage

The service delegation test covers the CRM KPI read/write path, and the successful Nest build verifies module wiring. No live PostgreSQL-backed `/crm/kpi` smoke was run because this task did not start a configured authenticated CRM environment.

## Concerns

- Deployments must have PostgreSQL connectivity and KPI schema/data ready because the SQLite fallback has been removed.
- The npm commands emit the existing unsupported `devdir` configuration warning.

## Commit

`Serve CRM KPI from PostgreSQL only.`
