# Task 10 Report — Service Finance PostgreSQL-only

## Status

Completed Wave 2 Task 10 only.

- `SvcFinanceService` delegates lifecycle billing summaries and payment operations directly to `SvcFinancePgRepository`.
- `SvcFinanceModule` registers only `SvcFinancePgRepository`; the obsolete finance feature flag and `ConfigModule` dependency were removed from this module.
- `svc-finance-sqlite.repository.ts` was deleted.
- `svc-finance.util.ts` was left unchanged because it has no active callers and is not part of the service/module runtime path.
- Added a service lifecycle billing contract test covering summary, list, create, patch, delete, and module wiring.

## Verification

- `npm test -- --runInBand src/svc-finance`
  - 1 suite passed
  - 2 tests passed
- `npm run build`
  - Passed (`nest build`)
- Scoped PostgreSQL-only static search
  - No SQLite repository, `node:sqlite`, `DatabaseSync`, `sqlitePath`, or service-finance feature-flag references in the active service, module, and PostgreSQL repository.
- Scoped `git diff --check`
  - Passed

## Commit

`Serve service finance from PostgreSQL only.`

## Concerns

- No live PostgreSQL/API session was available for an HTTP smoke test. The lifecycle billing tab operations are covered through direct repository-delegation tests.
- npm prints the pre-existing warning: `Unknown env config "devdir"`.
- Task 11 was not started.
