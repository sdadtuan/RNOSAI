# Task 13 Report — Payroll PostgreSQL-only

## Status

Completed Wave 2 Task 13 only.

- `PayrollService` and `PayrollModule` now depend only on `PayrollPgRepository`.
- Payroll policy, position rates, dashboard, attendance, payroll computation, edits, exports, and employee payslips now read and write PostgreSQL.
- `payroll-engine.ts` is database-agnostic and contains no SQLite imports.
- `payroll-sqlite.repository.ts` was deleted.
- Added a PostgreSQL-only boundary regression test.

## Verification

- `npm test -- --runInBand src/payroll`
  - 1 suite passed
  - 2 tests passed
- `npm run build`
  - Passed (`nest build`)
- Source search under `src/payroll`
  - No runtime `node:sqlite`, `PayrollSqliteRepository`, or `crmPayrollPg` references
- `git diff --check -- services/ptt-crm-api/src/payroll`
  - Passed

## Commit

`Serve CRM payroll from PostgreSQL only.`

## Notes

- The VPS pre-step remains required before deployment: set `PTT_CRM_PAYROLL_PG=1` in `.env`.
- No live PostgreSQL/API session was available for the `/crm/payroll` dashboard smoke; the automated boundary test and TypeScript build were run locally.
- Task 14 was not started.
