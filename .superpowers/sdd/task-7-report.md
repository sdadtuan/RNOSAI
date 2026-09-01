# Task 7 Report: DDL versions + learn_jobs (P2)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/intake-win-score-phase2` (current)  
**Commit:** _(pending)_ — feat(mkt-ai): DDL playbook versions and learn jobs  
**Pushed:** no

## What shipped

PostgreSQL schema for playbook versioning and learn-job tracking, wired into the existing MKT-AI DDL apply script after service policy DDL.

| File | Role |
|------|------|
| `docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-versions.sql` | `mkt_ai_playbook_versions` (status/depth/source CHECKs, one-active partial unique index), `mkt_ai_playbook_learn_jobs`, deferred FK from `mkt_ai_service_policy.active_version_id` → versions |
| `scripts/apply_pg_ddl_mkt_ai_planner.sh` | Applies versions DDL after policy DDL (`DDL_VERSIONS`) |

## Step checklist

- [x] Create DDL file verbatim from plan Task 7
- [x] Hook `apply_pg_ddl_mkt_ai_planner.sh` after policy DDL
- [ ] **Apply local** — blocked: Postgres at `127.0.0.1:5433` not running (`connection refused`)
- [x] **Commit** `feat(mkt-ai): DDL playbook versions and learn jobs`

## DDL summary

```sql
-- mkt_ai_playbook_versions: version_no per service_slug, status lifecycle, depth, document_json, source, learn_job_id, corpus_json, review fields
-- idx_mkt_ai_playbook_one_active: UNIQUE (service_slug) WHERE status = 'active'
-- mkt_ai_playbook_learn_jobs: queued/running/succeeded/failed, output_version_id FK
-- mkt_ai_service_policy_active_fk: DEFERRABLE FK active_version_id → mkt_ai_playbook_versions(id)
```

## Apply command (when DB up)

```bash
bash scripts/apply_pg_ddl_mkt_ai_planner.sh
```

## Concerns

1. **Local apply not verified** — dev Postgres not listening on port 5433 in this session. Re-run apply script when DB is up before Task 8 seed import.
2. **FK ordering** — versions DDL must run after policy DDL (policy table created first; FK added in versions file). Script order is correct.
