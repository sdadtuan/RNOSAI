# Task 13 Report: VPS UAT runbook (before flag=1)

**Date:** 2026-09-13  
**HEAD before:** `177e038848fee9b9d93ae7552e7457db102ff35a`  
**Commit:** `ba1db725` `docs(cp): VPS UAT runbook for AI Ops flags.`  
**Status:** DONE

## What was implemented

Human-run VPS UAT runbook at `docs/runbooks/cp-ai-ops-vps-uat.md`:

- Wave order A → B → C with per-flag restart; never flip all flags at once
- Env mẫu verbatim (all flags `0`, empty secrets)
- DDL human checklist: `scripts/apply_pg_ddl_cp_ai_ops.sh` + `scripts/apply_pg_ddl_cp_weave.sh` (plan A)
- Fail UAT list verbatim; workplace `?tab=ai-ops&pane=`
- Cửa B (no token on FE; Settings GET no key echo) and Cửa C (no `:8188` on flags JSON)
- Alerts: token fail, ingest fail, budget 80%, Comfy heartbeat
- Tenant `PTT`, prod `https://rs.pttads.vn`

## Hard rules observed

- No SSH, no DDL apply to live DB, no service restart, no flag=1 from this task
- No real secrets committed; CSD files not staged

## Tests

None required (docs-only).

## Concerns

- Runbook assumes ops runs DDL/restart on VPS manually; GPU Wave C remains gated on `COMFYUI_WORKER_ENABLED=0` until checklist complete.
