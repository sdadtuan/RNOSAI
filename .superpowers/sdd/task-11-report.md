# Task 11 Report — SOP PostgreSQL-only

## Status

Completed Wave 2 Task 11 only.

- `SopService` delegates templates, runs, run creation, and overdue tasks directly to `SopPgRepository`.
- `SopAutoStartService` uses PostgreSQL for lifecycle linkage, campaign lookup, template lookup, and run creation.
- `SopModule` registers and exports only `SopPgRepository`.
- The service-lifecycle SOP detail integration now reads runs and tasks from `SopPgRepository`.
- `sop-sqlite.repository.ts` was deleted and active source imports were removed.
- Added template/run service smoke coverage proving PostgreSQL delegation without the legacy feature flag.

## Verification

- `npm test -- --runInBand src/sop`
  - 2 suites passed
  - 5 tests passed
- `npm run build`
  - Passed (`nest build`)
- Source search for `SopSqliteRepository` and `sop-sqlite.repository`
  - No matches

## Commit

`Serve CRM SOP from PostgreSQL only.`

## Notes

- No live PostgreSQL/API session was available; template and run smoke coverage uses service-level repository mocks.
- npm prints the pre-existing warning: `Unknown env config "devdir"`.
- Task 12 was not started.
