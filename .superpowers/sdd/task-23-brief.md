# Task 23: Wave 3 DDL

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Copy pattern from:
- `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql`
- `scripts/apply_pg_ddl_am_w2.sh`

## Create

**`docs/specs/2026-09-05-postgresql-ddl-am-w3.sql`** — exact objects from the plan (header comment AM-20260905-w3):

1. `crm_am_interactions` — kinds `note|call|meeting|email|system`
2. `crm_am_risks`
3. `crm_am_recovery_plans`
4. `ALTER TABLE crm_am_tasks ADD COLUMN IF NOT EXISTS`:
   - `csd_ticket_id UUID`
   - `escalation_level TEXT`
   - `resolution_summary TEXT`
   - `resolution_category TEXT`

Optional (allowed): indexes on `(tenant_id, agency_client_id)` for the three new tables. Do **not** invent extra columns.

**`scripts/apply_pg_ddl_am_w3.sh`** — same as W2:
- source `.env` if present
- if `DATABASE_URL` unset: static verify (grep CREATE TABLE + ALTER columns) then `SKIP live apply` exit 0
- else `psql -v ON_ERROR_STOP=1 -f` the DDL

Do not require live apply. Do not commit `.superpowers/` or `node_modules`.

Commit: `feat(am): add Wave 3 tables for timeline, risk, and recovery`

Report: `.superpowers/sdd/task-23-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
