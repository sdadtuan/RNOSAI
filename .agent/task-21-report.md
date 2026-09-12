# Task 21 Report — Acceptance + deploy (flag off, no seed)

**Branch:** `feat/msos-w1-win`  
**Date:** 2026-09-12

## Deliverables

| File | Purpose |
|---|---|
| `services/ptt-crm-api/src/msos/msos-acceptance.spec.ts` | In-process acceptance locks (9 cases) |
| `services/ops-web/src/lib/crm/msos-acceptance.spec.ts` | FE denylist + gate button helpers (4 cases) |
| `scripts/deploy_msos_w1_vps.sh` | DDL apply + build + test; flags stay off; no seed |

## API acceptance coverage

1. Flag off → `media_os_disabled`
2. Happy path spine on same `media_line_id` (partner → inventory → placement → rate → package → hard reserve → IO issue → media line → traffic → human live → evidence official → finance request)
3. Hard+hard same day → `overbook_hard`
4. Report 282 / plan 300 material DC; `actual=300` → `actual_eq_plan_forbidden`
5. Finance request with draft pack → `evidence_not_official`
6. AI actor on live → `ai_action_forbidden`
7. `hide_buy_side: true` stored as `false` when reseller off
8. SQL audit: no `INSERT INTO clients|leads|crm_invoices`
9. No connector-write controller route; health `connector_write: false`

## Test results (final)

```bash
cd services/ptt-crm-api && npx jest src/msos/ --no-coverage
# Test Suites: 32 passed, 32 total
# Tests:       166 passed, 166 total

cd services/ops-web && npx vitest run src/lib/crm/msos
# Test Files  5 passed (5)
# Tests       19 passed (19)
```

**Total:** 185 tests green (166 API + 19 ops-web).

## Deploy script notes

- Applies `scripts/apply_pg_ddl_msos_w1_win.sh` only (schema + policy registry)
- Builds `ptt-crm-api` and `ops-web`; runs MSOS test suites
- Echoes warning: do **not** set `PTT_MEDIA_OS_ENABLED` / `NEXT_PUBLIC_MEDIA_OS` unless staging pilot
- No `\copy`, no INSERT partners/inventory/IO
- 5-line UAT runbook in script header comments

## Commit

`feat(msos): acceptance locks and flag-off deploy script`
