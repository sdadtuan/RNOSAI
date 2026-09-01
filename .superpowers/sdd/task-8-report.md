# Task 8 Report: Import disk playbooks → version active shipped (P1/P2)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** (pending) — feat(mkt-ai): import shipped playbooks into version table  
**Pushed:** no

## What shipped

Idempotent seed script imports `_common.json` + 3 industry playbooks into `mkt_ai_playbook_versions` as `active` / `shipped`, links `mkt_ai_service_policy.active_version_id` for pilot slugs and `_common`.

| File | Role |
|------|------|
| `scripts/seed_mkt_ai_playbook_versions.ts` | Read 4 JSON from `playbooks/`; INSERT active v1 when none exists; skip if active present; upsert `_common` policy (`rollout=ga`); UPDATE pilot `active_version_id` |

## Step checklist

- [x] Script reads `_common.json` + `meta-lead-gen`, `bds-lead-gen`, `seo-retainer`
- [x] INSERT `status=active`, `depth=shipped`, `source=common|disk`, `version_no` = next (1 on fresh DB)
- [x] Idempotent skip when active version already exists for slug
- [x] Set `active_version_id` on 3 pilot slugs + `_common` policy row
- [ ] **Apply seed on live DB** — blocked: Postgres at `127.0.0.1:5433` not running (`ECONNREFUSED`)
- [x] **Commit** `feat(mkt-ai): import shipped playbooks into version table`

## Seed behavior

1. Validates all 4 JSON files (slug matches filename) before DB work.
2. Per slug: if `status='active'` row exists → skip insert, reuse id for policy link.
3. Else: `INSERT` with `version_no = MAX(version_no)+1` (typically `1` on empty table).
4. Transaction with `SET CONSTRAINTS mkt_ai_service_policy_active_fk DEFERRED` so FK checks run at COMMIT.
5. `_common` policy: `INSERT … ON CONFLICT DO UPDATE` with `rollout='ga'`, `enabled=true`, `active_version_id`.
6. Pilot slugs (`meta-lead-gen`, `bds-lead-gen`, `seo-retainer`): `UPDATE mkt_ai_service_policy SET active_version_id`.

## Run commands

Prerequisites: Task 7 DDL applied + `scripts/seed_mkt_ai_service_policy.sql` (pilot policy rows).

```bash
bash scripts/apply_pg_ddl_mkt_ai_planner.sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed_mkt_ai_service_policy.sql
cd services/ptt-crm-api && NODE_PATH=./node_modules npx tsx ../../scripts/seed_mkt_ai_playbook_versions.ts
```

Dry-run (still connects to DB to detect existing actives):

```bash
cd services/ptt-crm-api && NODE_PATH=./node_modules npx tsx ../../scripts/seed_mkt_ai_playbook_versions.ts --dry-run
```

## What I tested

```bash
cd services/ptt-crm-api && NODE_PATH=./node_modules npx tsx ../../scripts/seed_mkt_ai_playbook_versions.ts --dry-run
```

```
== seed_mkt_ai_playbook_versions ==
playbooks=.../playbooks
dry_run=true
validated 4 playbook JSON file(s)
Error: connect ECONNREFUSED 127.0.0.1:5433
```

JSON validation passed; DB connection refused (same as Task 7 local apply).

## Concerns

1. **Local seed not verified end-to-end** — dev Postgres not listening on port 5433. Re-run seed when DB is up before Task 14 planner resolve.
2. **Run from `services/ptt-crm-api`** — `pg` is not hoisted to repo root; use `NODE_PATH=./node_modules` with `tsx` (ts-node fails on Node 26 in this env).
3. **Pilot policy rows required** — script warns if `mkt_ai_service_policy` row missing for a pilot slug; run policy seed first.
