# Task 17 Report: SEO default PostgreSQL

## Status

Completed Task 17 only.

## Changes

- Changed `seo_db_mode()` to default to `pg`, including when `SEO_AEO_DB` is blank.
- Updated the default-mode unit test to expect PostgreSQL and preserve an explicitly blank prior environment value.
- Existing SQLite-path tests continue to set `SEO_AEO_DB=sqlite` explicitly.

## Tests

- `python3 -m unittest tests.test_seo_aeo_pg_cutover -v`
  - Passed: 4
  - Skipped: 1 optional PostgreSQL integration test
- `PTT_RUN_FLASK_TESTS=1 python3 -m unittest tests.test_seo_aeo_phase4_aeo_v2 -v`
  - Passed: 8
- `python3 -m unittest tests.test_seo_aeo_phase4_aeo_v2 -v`
  - The module-level Flask guard raised `SkipTest`; the guarded suite passes when enabled as above.

## Commit

`Default SEO AEO storage to PostgreSQL.`
