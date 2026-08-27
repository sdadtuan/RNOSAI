# Task 10 — RE projects PostgreSQL cutover

## Status

Completed Task 10 only. The RE projects Nest module now injects PostgreSQL repositories exclusively.

## Implemented

- Ported every public method from `ReProjectsSqliteRepository` to `ReProjectsPgRepository`.
- Split staff and lead-channel persistence into `ReProjectsChannelsPgRepository`.
- Ported project types, projects, products, KPIs, risks, budgets, price lists, staff assignments, lead config, Facebook forms, Zalo campaigns, website routes, summaries, workflows, and exports.
- Replaced SQLite cash-flow/accounting persistence with PostgreSQL and converted accounting utilities/services to async repository calls.
- Updated the downstream lead-routing context to await the async RE project staff lookup.
- Added a cutover contract test that checks public-method parity and rejects SQLite wiring.
- Did not modify or query any `crm_b2b_*` table.

## Verification

- `npx jest src/re-projects --no-coverage` — PASS (1 suite, 3 tests).
- `npm run build` in `services/ptt-crm-api` — PASS.
- Static search in active RE project files — no `ReProjectsSqliteRepository`, `node:sqlite`, or `sqlitePath`.
- Static search in the new PG repository — no `crm_b2b_*`.

## Concerns

- No live PostgreSQL/VPS smoke was run in this task environment. Runtime DDL compatibility and existing production data should be checked on staging/VPS before deployment.
- Full `tsc --noEmit` still reports unrelated pre-existing constructor-arity errors in other test files; the production Nest build passes.
# Task 10 report — Smoke + docs + health

**Status:** done  
**Branch:** `feat/cmkt-video-social-ffmpeg-v1`  
**Commit:** `65f479e5` `docs(cmkt): social ffmpeg V1 smoke + UI guide`  
**Pushed:** no

## What shipped

- `scripts/smoke_content_marketing_video_social_v1.sh` — auth/lifecycle pattern from P2; step 0 `ffmpeg -version`; create+approve `video_script`; `lock-studio` social; `video-storyboard` (reels); poll job; optional `video-render` + `.mp4` URL assert; `SMOKE_SKIP_FFMPEG=1` skip path for CI.
- `docs/huong-dan-su-dung/18-content-marketing-os.md` §17 — V1 UI (picker FFmpeg vs SOP disabled, storyboard→render→`<video>`), packs, quota 3/day, visual approve cleans DRAFT, flags table; §2.2 `VIDEO_PROVIDER` default `ffmpeg`; smoke commands in §2.3.
- `scripts/deploy_content_marketing_staging.sh` — staging kv: `PTT_CMKT_VIDEO_PROVIDER=ffmpeg`, `PTT_CMKT_VIDEO_SOCIAL=1`, `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP=3` (kept `PTT_CMKT_VIDEO_GEN=1`).

## Verification

```
bash -n scripts/smoke_content_marketing_video_social_v1.sh
# exit 0 — syntax OK
```

Live API smoke not run in this environment (no guaranteed staff token / ffmpeg / VPS).

## Health

Skipped `/health` ffmpeg boolean — smoke step 0 preferred per brief.

## Concerns

1. Smoke assumes API reachable; local dev without server will fail at curl (expected).
2. `18-content-marketing-os.md` committed as new tracked file (was untracked in workspace).
3. VPS must have `ffmpeg` binary installed separately — deploy script sets flags only.

## Important review findings follow-up — 2026-08-27

- Replaced SQLite integer boolean predicates in the RE projects PostgreSQL repositories with native PostgreSQL boolean predicates:
  - Active project types and KPI metrics use `active IS TRUE`.
  - Nullable staff activity uses `active IS NOT FALSE`.
  - Duplicate lead exclusion uses `is_duplicate IS NOT TRUE`.
- Aligned the RE project type bootstrap schema and write parameters with PostgreSQL `BOOLEAN`.
- Corrected staff KPI synchronization to write `crm_staff_kpi.notes` and update from `EXCLUDED.notes`.
- Added `re-projects-pg.repository.spec.ts` with regression checks for the PostgreSQL SQL strings.

### Follow-up verification

- `npx jest src/re-projects --no-coverage` — PASS (2 suites, 5 tests).
- `npm run build` — PASS.
