# Task 4 report — Intake PostgreSQL-only cutover

## Status

Implemented Wave 2 Task 4 only.

- `IntakeService` now uses `IntakePgRepository` for every intake operation.
- Removed the `crmIntakePg` runtime branch and SQLite dependency from the service.
- `IntakeModule` now provides and exports only `IntakePgRepository`.
- Deleted `intake-sqlite.repository.ts`.
- Confirmed no SQLite intake repository or feature-flag references remain under `src/intake`.
- Task 5 was not started.

## Verification

- `npm --prefix services/ptt-crm-api test -- --runInBand src/intake`
  - 2 suites passed.
  - 2 tests passed.
- `npm --prefix services/ptt-crm-api run build`
  - Passed.

## Presales intake queue smoke

The intake Jest selection includes the presales synchronization utility and passed. No live PostgreSQL-backed UI/API smoke was run because this task did not start a local authenticated CRM environment.

## Commit

`Serve CRM intake from PostgreSQL only.`
