# Task 12 Report: Wave 2 DDL

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `d1ccedfd` — feat(am): add Wave 2 tables for 360, onboard, and renewal  
**Date:** 2026-09-05

## Deliverables

| File | Purpose |
|------|---------|
| `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql` | Wave 2 DDL (verbatim from brief) |
| `scripts/apply_pg_ddl_am_w2.sh` | Apply script (Wave 1 style; no RBAC seed) |

## Tables & index

1. `crm_am_contacts` — 360 contact records  
2. `crm_am_handovers` — handover workflow (`status` CHECK)  
3. `crm_am_onboarding_templates` — template catalog (`UNIQUE tenant_id, name, version`)  
4. `crm_am_onboarding_cases` — per-client onboarding  
5. `crm_am_renewal_cases` — renewal pipeline (`status` CHECK)  
6. `crm_am_renewal_open_uq` — partial unique index on open renewals

## Verification

```bash
./scripts/apply_pg_ddl_am_w2.sh
# SKIP live apply — DATABASE_URL unset
# OK  AM W2 DDL static verify (5 tables + crm_am_renewal_open_uq)
```

- Live `psql` apply skipped (no `DATABASE_URL` in env).  
- Static grep confirms all 5 `CREATE TABLE IF NOT EXISTS` statements and `crm_am_renewal_open_uq` index.  
- No RBAC seeding (per brief).

## Brief checklist

- [x] Create SQL spec (verbatim)  
- [x] Create apply script (Wave 1 style, static fallback)  
- [x] Static verify  
- [ ] Live apply — pending `DATABASE_URL` / PO VPS step

## Next

Apply on target DB when `DATABASE_URL` is set: `./scripts/apply_pg_ddl_am_w2.sh`. Wave 2 services can depend on these tables.
