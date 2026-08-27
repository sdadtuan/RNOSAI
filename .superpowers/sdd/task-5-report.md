# Task 5 report — Leads contract PostgreSQL-only cutover

## Status

Implemented Wave 2 Task 5 only.

- `LeadsContractService` now delegates every contract operation to `LeadsContractPgRepository`.
- Removed the `usePgContract` runtime branch, configuration dependency, and SQLite dependency.
- `LeadsContractModule` now provides and exports only the PostgreSQL repository.
- Updated the agency onboarding summary dependency to use the asynchronous PostgreSQL lifecycle lookup required after deleting the SQLite repository.
- Deleted `leads-contract-sqlite.repository.ts`.
- Confirmed no `usePgContract`, `LeadsContractSqliteRepository`, or deleted repository imports remain under `src`.
- Task 6 was not started.

## Verification

- `npm --prefix services/ptt-crm-api test -- src/leads-contract --runInBand`
  - 1 suite passed.
  - 1 test passed.
- `npm --prefix services/ptt-crm-api run build`
  - Passed.

## Readiness / promote smoke

The selected Jest suite exercised contract readiness. The successful Nest build verified the PostgreSQL promote path and its module wiring compile. No live PostgreSQL-backed promote was run because this task did not start a configured authenticated CRM environment.

## Commit

`Serve leads contract from PostgreSQL only.`
