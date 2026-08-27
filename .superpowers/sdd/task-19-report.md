# Task 19 Report — CRM no-SQLite CI gate

## Status

Completed Task 19 only.

## Changes

- Tightened `scripts/crm_no_sqlite_gate.sh` to exclude only `*.spec.ts` and `wave*-pg.constants.ts`.
- Added `.github/workflows/crm-no-sqlite-gate.yml` for pull requests and pushes to `main` that touch the CRM Nest source or gate.
- Updated the RBAC no-SQLite gate comment to point Nest runtime enforcement to the CRM gate.
- Removed obsolete SQLite-only finance, owner-weekly, billing, and leads-contract utilities, including the dead billing SQLite spec.
- Moved `PresalesPromoteSource` to the PostgreSQL contract promotion utility so runtime code no longer depends on the deleted SQLite implementation.

## Verification

- `./scripts/crm_no_sqlite_gate.sh`: passed with `crm_no_sqlite_gate: PASS`.
- `npm --prefix services/ptt-crm-api run build`: passed.
- Focused Jest run: 2 suites passed, 7 tests passed.
- Scoped `git diff --check`: passed.

## Concerns

- `actionlint` is not installed locally; the workflow structure mirrors the existing RBAC gate workflow.
