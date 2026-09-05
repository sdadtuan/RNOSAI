# Task 1 Report: Wave 1 DDL

**Status:** DONE  
**Branch:** feat/am-os  
**Commit:** acb8acbe — feat(am): add Wave 1 PostgreSQL tables for Account Management OS

## Deliverables

| File | Action |
|------|--------|
| `docs/specs/2026-09-05-postgresql-ddl-am.sql` | Created |
| `scripts/apply_pg_ddl_am.sh` | Created (mode 755) |

## Verification

### Static checks (passed)

- DDL file exists and defines **8** `crm_am_*` tables:
  1. `crm_am_account_ext` — PK `agency_client_id UUID`; status/parent CHECK constraints; 3 indexes
  2. `crm_am_plans` — `contract_id BIGINT`; kind CHECK; unique `(tenant_id, agency_client_id, kind, period_key)`
  3. `crm_am_tasks` — FK to `crm_am_plans`; kind/status CHECK; partial unique index on `(tenant_id, source, source_ref)`
  4. `crm_am_health_snapshots` — band CHECK; unique `(tenant_id, agency_client_id, as_of)`
  5. `crm_am_settings` — default weights/bands JSONB; `INSERT … ON CONFLICT DO NOTHING` for PTT
  6. `crm_am_saved_views`
  7. `crm_am_notifications`
  8. `crm_am_audit` — `BIGSERIAL` PK
- Apply script follows `apply_pg_ddl_csd.sh` pattern: sources `.env`, requires `DATABASE_URL`, runs `psql -v ON_ERROR_STOP=1 -f`.
- **No RBAC cap seeding** — apply script ends after DDL apply (no `seed_*_rbac.sh` call).
- `scripts/apply_pg_ddl_am.sh` is executable (`chmod +x`).

### Apply test

**Skipped** — `DATABASE_URL` was unset in the environment and no `.env` with credentials was loaded. To apply locally:

```bash
# set DATABASE_URL in .env or export, then:
./scripts/apply_pg_ddl_am.sh
psql "$DATABASE_URL" -c "\dt crm_am_*"
psql "$DATABASE_URL" -c "SELECT weights_json FROM crm_am_settings WHERE tenant_id='PTT'"
```

Expected after apply: 8 tables listed; weights_json `{"kpi_delivery":30,"engagement":20,"financial":20,"satisfaction":15,"contract_support":15}`.

## Self-review

- DDL matches task brief verbatim (columns, types, defaults, constraints, indexes, seed row).
- Locked IDs respected: `agency_client_id UUID`, `contract_id BIGINT`.
- Apply script intentionally omits user RBAC seed per brief.
- Commit includes **only** the two specified files; `.superpowers/`, plan, SRS, and mockup files were not staged.

## Concerns

None. Live `psql` apply not run due to missing `DATABASE_URL`; static verification is complete.
