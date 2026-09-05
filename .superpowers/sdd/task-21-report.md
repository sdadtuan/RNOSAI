# Task 21 Report: Settings scorecard + health override (UI-AM-23, ACT-021/025)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `7fe65db4` — feat(am): add scorecard settings and health override  
**Date:** 2026-09-05

## Summary

PUT `/api/crm/am/settings` publishes scorecard weights/bands (`manage`). Weights must sum to 100; bands must be four integer pairs, non-overlapping, contiguous 0–100. Publish increments `scorecard_version` and audits `settings.publish`. POST `/api/crm/am/health/:agencyClientId/override` writes `override_*` on the latest snapshot (or upserts today’s row). 360 GET exposes `override: { band, reason, until } | null` when `until >= today ICT`. Settings UI keeps the onboarding template panel and adds a Scorecard section above it.

## Backend

- `AmSettingsService.publish` + CLASS `AmSettingsRepository.save`
- `PUT /api/crm/am/settings` (`manage`) — 400 `weights_sum` / `bands_overlap`; no UPDATE on fail
- `POST /api/crm/am/health/:agencyClientId/override` (`manage`) — blank reason → 400 `reason_required`; until after today ICT + 30 days or before today → 400 `override_until_invalid`; invalid band → 400 `invalid_band`; out of scope → 404; audit `health.override`
- `GET /api/crm/am/settings` now returns `scorecard_version`
- `GET /api/crm/am/accounts/:id` adds `override` when latest snapshot override is active
- Health recompute reads current settings version/bands; `ON CONFLICT` no longer overwrites `scorecard_version`
- `bandFromScore(score, bands?)` — defaults stay 80/60/40
- DDL append on `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql`: `ALTER TABLE crm_am_settings ADD COLUMN IF NOT EXISTS scorecard_version INTEGER NOT NULL DEFAULT 1`
- 42703 on `scorecard_version`: treat version as 1 and still persist weights

## Frontend

- `AmSettings.tsx`: Scorecard above templates. 5 weights + 4 band ranges + `scorecard_version`. Non-manage read-only. Manage: edit + `Xuất bản scorecard`. Surfaces `weights_sum` / `bands_overlap`.
- `AmAccount360`: banner `Health override: {band} đến {until}. {reason}`. Manage: Override health (band + reason + until).
- Health detail page left as Wave 3 placeholder.

## TDD evidence

**RED** (methods / module missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-settings.service.spec.ts src/am/am-health.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# TS2339: Property 'publish' does not exist on type 'AmSettingsService'
# TS2339: Property 'override' does not exist on type 'AmHealthService'
# TS2551: Property 'putSettings' does not exist on type 'AmController'

$ cd services/ops-web && npx vitest run src/lib/crm/am-settings.util.spec.ts
# Cannot find module './am-settings.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-settings.service.spec.ts src/am/am-health.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# 3 suites, 17 passed

$ cd services/ops-web && npx vitest run src/lib/crm/am-settings.util.spec.ts
# 1 file, 2 passed
```

Required cases: weights 29/20/20/15/15 → 400 `weights_sum` (no UPDATE); overlapping bands → 400 `bands_overlap` (no UPDATE); until today+31 ICT → 400 `override_until_invalid` (no snapshot write); PUT settings metadata action is `manage`.

## Files

- `services/ptt-crm-api/src/am/am-settings.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-health.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-health.util.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am-accounts.service.ts`
- `services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts`
- `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql`
- `services/ops-web/src/lib/crm/am-settings.util.ts` (+ spec)
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/components/crm/am/AmSettings.tsx`
- `services/ops-web/src/components/crm/am/AmAccount360.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Self-review

- Caps match brief (`view` GET / `manage` PUT + override).
- Reused CLASS `AmSettingsRepository` / `AmHealthRepository`; no type-only Nest tokens.
- Onboarding template panel kept. No nested `<main>`, no KPI Hub / CSD CSS, no field/SLA settings.
- `.superpowers/` and `node_modules` not committed.

## Concerns

- Live `DATABASE_URL` was not applied. Until w2 SQL runs, `scorecard_version` SELECT/UPDATE hits 42703: version is treated as 1 and weights still persist.
- Override scope for `manage`/`view_all` is `all`; other actors use `me`. Team-scope IDs are not loaded on override (manage users typically have view_all).
- Health detail page remains Wave 3 placeholder; banner lives on 360 only.
- UI was not browser-verified (no running ops-web session).

DONE_WITH_CONCERNS
