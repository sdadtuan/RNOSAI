# Task 23 Report: Wave 3 DDL

**Branch:** `feat/am-os`  
**Worktree:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os`

## Deliverables

| File | Status |
|------|--------|
| `docs/specs/2026-09-05-postgresql-ddl-am-w3.sql` | Created |
| `scripts/apply_pg_ddl_am_w3.sh` | Created |

## DDL objects (from plan, AM-20260905-w3)

1. **`crm_am_interactions`** — kind CHECK: `note|call|meeting|email|system`
2. **`crm_am_risks`**
3. **`crm_am_recovery_plans`**
4. **`ALTER TABLE crm_am_tasks`** — added columns:
   - `csd_ticket_id UUID`
   - `escalation_level TEXT`
   - `resolution_summary TEXT`
   - `resolution_category TEXT`

Optional indexes on `(tenant_id, agency_client_id)` added for all three new tables.

## Apply script

Mirrors `scripts/apply_pg_ddl_am_w2.sh`:
- Sources `.env` when present
- When `DATABASE_URL` unset: static verify (3 CREATE TABLE + 4 ALTER columns) then exit 0 with `SKIP live apply`
- When set: `psql -v ON_ERROR_STOP=1 -f` the DDL file

## Verification

```text
$ unset DATABASE_URL && scripts/apply_pg_ddl_am_w3.sh
SKIP live apply — DATABASE_URL unset
OK  AM W3 DDL static verify (3 tables + 4 crm_am_tasks columns)
```

Exit code: 0

## Commit

`feat(am): add Wave 3 tables for timeline, risk, and recovery` — only the two deliverable files; `.superpowers/` not committed.

## Notes

- No extra columns beyond the plan.
- Live apply not required or performed (no `DATABASE_URL` in this environment).

DONE
