# Task 16 Report — Python worker PG-only cleanup

## Status

Implemented Task 16 only. Lead and form worker handlers now always dispatch to PostgreSQL ingest, and `form_lead_ingest.py` no longer imports or executes SQLite lead-store/project-resolution code.

CRM SQLite connections now fail closed for PostgreSQL writes. The retained `db_path()` helper requires the explicit `PTT_ALLOW_SQLITE_TESTS=1` test opt-in. Lead replica/shadow entry points return a disabled no-op before touching either database when `PTT_LEAD_SHADOW_SYNC=0`.

The legacy `crm_lead_store.py` and `crm_lead_presales.py` modules do not open databases themselves and are no longer reachable from the worker ingest paths. The autonomous SQLite background path in `crm_lead_intake.py` is disabled in PostgreSQL mode.

## Verification

- Required unittest command: PASS — 39 tests
- Related lead sync/shadow tests: PASS — 5 passed, 2 PostgreSQL integration tests skipped
- CRM SQLite explicit test-mode compatibility: PASS — 6 tests
- Changed Python module syntax parse: PASS
- Scoped `git diff --check`: PASS

## Scope guard

Task 17 was not started.
