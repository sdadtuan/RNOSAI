# Task 9 Report — Owner weekly PostgreSQL cutover

## Status

Completed Task 9 only. Owner weekly now injects its own `OwnerWeeklyPgRepository`; it does not import the SQLite repository or the ops-weekly PostgreSQL repository.

## Changes

- Added PostgreSQL schema/bootstrap and CRUD for `crm_owner_cash_snapshots`.
- Preserved owner-weekly config, dashboard, export, alert, inbox sync, and inbox summary response shapes using PostgreSQL queries.
- Rewired `OwnerWeeklyService` and `OwnerWeeklyModule` exclusively to the PostgreSQL repository.
- Added tests for hard-cutover wiring, domain separation, schema creation, snapshot listing, upsert, and deletion.

## Verification

- `npx jest src/owner-weekly --no-coverage`
  - 1 suite passed
  - 5 tests passed
- `npm run build`
  - Passed
- Cutover grep across the service, module, and PG repository found no `DatabaseSync`, `sqlitePath`, SQLite repository, or ops-weekly PG references.

## Scope

Task 10 was not started.
# Task 9 Report — Smoke S11 + SC-15 registry fields

**Branch:** `feat/vd-sop-s11`  
**Date:** 2026-08-21  
**Status:** DONE_WITH_CONCERNS

## Summary

SC-15 Models table now shows `model_key` (= `code`) and `verified_at` (from `capability_json`). Added S11 smoke script that asserts registry seed `video.kling.v3.pro` / `VIA_LEONARDO` and reuses S10 production-report 7-metric check. No vendor HTTP POSTs.

## Deliverables

| File | Action |
|------|--------|
| `scripts/smoke_video_sop_s11.sh` | **Created** — cinematic gate, admin models assert, SC-16 report |
| `services/ops-web/src/app/admin/video/providers/page.tsx` | **Modified** — `model_key` + `verified_at` columns |
| `services/ops-web/src/lib/video-sop-api.ts` | **Modified** — `vdModelKey`, `vdModelVerifiedAt` helpers |
| `services/ops-web/src/lib/video-sop-api.spec.ts` | **Modified** — helper unit tests |

## Smoke behavior

1. `PTT_CMKT_VIDEO_CINEMATIC!=1` → `SKIP cinematic off` exit 0
2. `GET /api/v1/vd/admin/models`:
   - 200 + items → require `video.kling.v3.pro` with `capability_json.route === VIA_LEONARDO`
   - 404/empty + no `DATABASE_URL` → SKIP (DDL may be unapplied)
   - 404/empty with `DATABASE_URL` → FAIL clearly
3. `GET /api/v1/vd/reports/production?lifecycle_id=3` → 200 + exact 7 S10 metrics
4. No Leonardo/Runway/Kling/Topaz/OpenAI HTTP; no vendor POST

## Verification

| Step | Result |
|------|--------|
| `bash -n scripts/smoke_video_sop_s11.sh` | **PASS** |
| `PTT_CMKT_VIDEO_CINEMATIC=0 bash scripts/smoke_video_sop_s11.sh` | **SKIP** exit 0 |
| `./node_modules/.bin/jest src/video-sop --no-coverage` (ptt-crm-api) | **PASS** 37 suites / 171 tests |
| `./node_modules/.bin/vitest run src/lib/video-sop-api.spec.ts` (ops-web) | **PASS** 67 tests |

## Intentionally out of scope

- No vendor adapter live calls
- No VPS deploy / DDL apply
- No page component vitest (no existing page spec; API helper tests updated instead)

## Commit

`feat(vd): S11 registry smoke and SC-15 verified_at`

## Concerns

- Live smoke against API not exercised here (cinematic off / no auth in this environment); registry assert only runs when cinematic on and models endpoint returns seeded rows.
- Empty models without `DATABASE_URL` SKIP means local CI without DB will not prove S11 seed presence.
