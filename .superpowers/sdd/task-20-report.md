# Task 20 Report — E2E and local PostgreSQL scripts

## Status

Completed Task 20 only.

## Changes

- Made `scripts/local_crm_api_up.sh` require `DATABASE_URL` and removed its SQLite path.
- Added `scripts/lib/pg_e2e_env.sh` as the shared PostgreSQL-only environment for local Playwright API runners.
- Updated 28 `scripts/playwright_ops_*.sh` runners to remove SQLite configuration and hard-coded PostgreSQL URL defaults.
- Replaced the AI Copilot SQLite fixture with an idempotent PostgreSQL lead seed in `scripts/rnos39_e2e_bootstrap.sh`.
- Retired the SQLite hub sync step in `scripts/deploy_post_v3.sh`.
- Made `scripts/backup_ptt_data.sh` require `DATABASE_URL` and produce PostgreSQL dumps only.
- Added regression coverage in `tests/test_task20_pg_scripts.py`.

## Verification

- `python3 -m unittest tests.test_task20_pg_scripts`: 6 tests passed.
- `bash -n` on every changed shell script: passed.
- Scoped SQLite/default-database scans for local, backup, and Playwright scripts: no matches.
- Scoped `git diff --check`: passed.

## Concerns

- A live Playwright smoke could not run: the documented `rs-staging.pttads.vn` hostname does not resolve, Docker Desktop is not running, and no PostgreSQL service is listening on local port 5433.
