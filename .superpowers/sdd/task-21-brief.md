# Task 21: Settings scorecard + health override (UI-AM-23, ACT-021/025)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 21
- SRS UI-AM-23: weights 100%, bands no overlap, versioning, validate before publish
- Existing GET `AmSettingsService` / `AmSettings.tsx` (templates only — **keep that panel**)
- Health: `am-health.service.ts` currently hardcodes `SCORECARD_VERSION = 1` and `bandFromScore` 80/60/40
- Snapshots already have `override_band`, `override_reason`, `override_until`
- 360 SQL already prefers `override_band` when `override_until >= CURRENT_DATE` (`am-accounts.service.ts` ~856). Expose those fields + banner.

## Do not

- Remove the onboarding template panel
- Field/SLA settings (Wave 4)
- Nested `<main>`, new packages, KPI/CSD CSS
- Type-only Nest tokens
- Commit `.superpowers/` / `node_modules`

## APIs

```
PUT  /api/crm/am/settings                         manage
POST /api/crm/am/health/:agencyClientId/override  manage
```

GET settings already `view`. PUT must be `manage` (guard → 403 for view-only).

### PUT body

```
{
  weights: { kpi_delivery, engagement, financial, satisfaction, contract_support },
  bands: { healthy:[lo,hi], watch, at_risk, critical },
  quota_accounts_per_am?, watch_ends_on_days?, health_drop_alert?, rollup_parent_health?
}
```

Validate:
- Each weight finite ≥ 0; **sum === 100** else **400 `weights_sum`** (29/20/20/15/15 = 99)
- Bands: four pairs integers; **no overlap**; **contiguous** covering **0–100** (after sort: first.lo=0, last.hi=100, next.lo = prev.hi+1) else **400 `bands_overlap`**
- On success: persist JSON, `updated_at`, `updated_by_staff_id`
- Increment `scorecard_version` (see versioning). Return full settings including `scorecard_version`
- Audit `settings.publish`

### Versioning (no fake history rewrite)

Settings table has no version column. **Append** to `docs/specs/2026-09-05-postgresql-ddl-am-w2.sql`:

```sql
ALTER TABLE crm_am_settings
  ADD COLUMN IF NOT EXISTS scorecard_version INTEGER NOT NULL DEFAULT 1;
```

Do not require live `DATABASE_URL`. Service SELECT/UPDATE that column; if 42703, treat version as 1 and still persist weights (note in report).

Health upsert: **new** `as_of` rows get current settings version. `ON CONFLICT` must **not** overwrite `scorecard_version` of an existing snapshot. Remove hardcoded `SCORECARD_VERSION = 1`. `bandFromScore` must accept settings bands (update util + existing tests if they assume 80/60/40 defaults — defaults stay the same).

### Override POST

Body: `{ band: AmHealthBand, reason: string, until: YYYY-MM-DD }`

- Blank reason → 400 `reason_required`
- `until` after today ICT + 30 days → **400 `override_until_invalid`**
- `until` before today → 400
- Invalid band → 400
- Account out of scope → 404
- Write on **latest** snapshot (or upsert today's row with existing score/band if none): set override_* 
- Displayed band while until ≥ today ICT = override_band
- Audit `health.override`
- Return `{ agency_client_id, band, reason, until }`

### 360 GET

Add `override: { band, reason, until } | null` when latest snapshot has an active override (`until >= today ICT`).

## UI

`AmSettings.tsx`: new **Scorecard** section above templates.
- Show 5 weights + 4 band ranges + `scorecard_version`
- Non-manage: read-only (UAT #9)
- Manage: edit + `Xuất bản scorecard` → PUT; show `weights_sum` / `bands_overlap`

`AmAccount360`: if `override`, banner e.g. `Health override: {band} đến {until}. {reason}`
Manage: small “Override health” control (band + reason + until) calling the POST.

Health detail page may stay Wave 3 placeholder; reuse banner component if you touch it.

## Tests (TDD)

Jest `am-settings.service.spec.ts` (new):
1. weights 29/20/20/15/15 → 400 `weights_sum`; no UPDATE
2. overlapping bands (e.g. watch [60,80] vs healthy [80,100]) → 400 `bands_overlap`

Jest health override (new or extend `am-health.service.spec.ts`):
3. until = today+31 ICT → 400 `override_until_invalid`; no snapshot write

PUT 403: extend `staff-am.guard.spec.ts` **or** assert `AmController` PUT `settings` metadata action is `manage` (view-only cannot pass guard). Do not add a service-level fake 403 if the guard already does it — the metadata assertion + existing guard tests satisfy “view PUT → 403”.

Vitest: `amSettingsWeightsError` / `amSettingsBandsError` helpers.

```
cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-settings.service.spec.ts src/am/am-health.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-settings.util.spec.ts
```

## Commit

`feat(am): add scorecard settings and health override`

HEREDOC. Never `--no-verify`. Never update git config.

## Report

`.superpowers/sdd/task-21-report.md` with RED/GREEN.

Final line: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
