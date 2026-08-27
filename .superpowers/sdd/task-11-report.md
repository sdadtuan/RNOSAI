# Task 11 Report — Worker/Python PG-only form ingest

## Status

Completed Task 11 only.

- `ptt_jobs.handlers.form_ingest.process_form_ingest_payload` now routes directly to the PostgreSQL-primary ingest pipeline when `PTT_LEADS_WRITE_SOURCE=pg`.
- The PostgreSQL route does not open a SQLite connection.
- The existing SQLite form ingest path remains available when the write source is `sqlite`.
- `open_ingest_rules_conn()` already avoided `_open_sqlite_readonly()` for PostgreSQL rules, and shadow sync entry points already no-op when `PTT_LEAD_SHADOW_SYNC=0`; no changes were needed there.

## Test evidence

The new regression test first failed with `AssertionError: SQLite forbidden` at the existing `sqlite3.connect` call.

After implementation:

```text
python3 -m unittest tests.test_form_ingest_pg tests.test_lead_ingest_config -v

Ran 6 tests in 0.037s
OK
```

## Files changed

- `ptt_jobs/handlers/form_ingest.py`
- `tests/test_form_ingest_pg.py`
- `.superpowers/sdd/task-11-report.md`

The VPS worker was not restarted from this local implementation session.

## Review gap fix (form_lead_ingest fail-closed)

Added defense-in-depth PG guard to `ptt_crm/form_lead_ingest.py`:

- When `leads_write_source_pg()` is true, `ingest_lead_from_form` delegates to `_ingest_lead_from_form_pg` via `process_ingest_lead_payload_pg` and never touches the SQLite connection argument.
- SQLite OLTP path remains unchanged when write source is `sqlite`.

Test evidence after guard:

```text
python3 -m unittest tests.test_form_ingest_pg tests.test_lead_ingest_config -v

Ran 7 tests in 0.031s
OK
```

Additional files changed:

- `ptt_crm/form_lead_ingest.py`
- `tests/test_form_ingest_pg.py` — `test_form_lead_ingest_module_pg_does_not_use_sqlite_conn`

Commit: `Fail closed form_lead_ingest when write source is pg.`
