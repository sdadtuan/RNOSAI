# Task 7 report — Leads repository PostgreSQL-only cutover

## Status

Implemented Wave 2 Task 7 only.

- `LeadsRepository` now serves list and detail reads exclusively through `PgLeadsRepository`.
- Removed the SQLite repository injection, read-source branches, and SQLite database-path override.
- `LeadsModule` now provides PostgreSQL leads repositories only.
- `AppConfigService.leadsReadSource` is fixed to `'pg'`; `PTT_LEADS_READ_SOURCE` no longer selects SQLite.
- Deleted `sqlite-leads.repository.ts`.
- Added a repository test covering PostgreSQL-only list and detail delegation.
- Task 8 was not started.

## Verification

- `npm --prefix services/ptt-crm-api test -- --runInBand src/leads`
  - 36 suites passed.
  - 131 tests passed.
- `npm --prefix services/ptt-crm-api run build`
  - Passed.

## Smoke coverage

The repository delegation test covers the leads API read path, and the successful Nest build verifies module wiring. No live PostgreSQL-backed `/crm/leads` smoke was run because this task did not start a configured authenticated CRM environment.

## Concerns

- Deployments must have PostgreSQL connectivity and the leads schema/data ready because the SQLite fallback has been removed.
- The npm commands emit the existing unsupported `devdir` configuration warning.

## Commit

`Serve leads API read path from PostgreSQL only.`
