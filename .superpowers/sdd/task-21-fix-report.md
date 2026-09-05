# Task 21-FIX Report: Override carry-forward + band gaps

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `1e97bf02` — fix(am): carry health override across snapshots  
**Date:** 2026-09-05

## Summary

Recompute now copies an active health override onto a new `as_of` INSERT so 360 still shows the banner until `override_until`. `bandFromScore` walks bands high-to-low (`score >= lo`) so `round1` values in the integer gaps (79.5 / 59.5 / 39.5) land on watch / at_risk / critical. PUT 400 codes unchanged. No field/SLA UI.

## Fixes

1. **Override dies on the next new `as_of`** — `upsertSnapshot` loads the latest snapshot’s `override_*`. If `override_until >=` today ICT, INSERT writes those three columns. Same-day `ON CONFLICT` still does not set `scorecard_version` (or override columns).
2. **`bandFromScore` mapped 79.1–79.9 (and 59.x / 39.x) to `critical`** — inclusive integer `hi` left a hole for `round1` scores. Walk floors high-to-low. Defaults stay 80/60/40: 80 → `healthy`, 79.5 → `watch`.

## TDD evidence

**RED** (tests added, INSERT still omitted override columns; 79.5 still fell through to `critical`):

```
$ /Users/quoctuan/Documents/CursorAI/RNOSAI/services/ptt-crm-api/node_modules/.bin/jest \
  --config …/feat-am-os/services/ptt-crm-api/jest.config.js \
  --rootDir …/feat-am-os/services/ptt-crm-api \
  src/am/am-health.util.spec.ts src/am/am-health.service.spec.ts --no-coverage
# 79.5: expected "watch", received "critical"
# INSERT SQL: expected /override_band/, received thin_data-only column list
# 2 failed, 8 passed
```

**GREEN:**

```
$ same command
# 2 suites, 10 passed

$ same binary + config + rootDir
  src/am/am-health.util.spec.ts src/am/am-health.service.spec.ts \
  src/am/am-settings.service.spec.ts src/am/am-accounts-360.spec.ts --no-coverage
# 4 suites, 25 passed
```

Required: previous row has active override; upsert new as_of → INSERT includes `override_band` / `override_reason` / `override_until` (SQL + params). Same-day ON CONFLICT still must not overwrite `scorecard_version`. 79.5 → watch; 39.5 → critical; 59.5 → at_risk.

## Files

- `services/ptt-crm-api/src/am/am-health.service.ts`
- `services/ptt-crm-api/src/am/am-health.service.spec.ts`
- `services/ptt-crm-api/src/am/am-health.util.ts`
- `services/ptt-crm-api/src/am/am-health.util.spec.ts`

Commit contains only those four files. `.superpowers/` and `node_modules` not staged.

## Concerns

1. **Carry-forward test is mocked** — Jest drives `pool.query`; not a live recompute against Postgres.
2. **Same-day ON CONFLICT does not backfill override** — if today’s row already exists without override, UPDATE leaves override columns untouched (brief asked only for INSERT copy).
3. **Worktree has no local Jest** — ran the main `services/ptt-crm-api` Jest binary with explicit `--config` / `--rootDir` on this worktree.

DONE_WITH_CONCERNS
