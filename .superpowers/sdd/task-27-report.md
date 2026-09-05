# Task 27 Report: Health & Risk Center + detail (UI-AM-19/20)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `c9ddf434` — feat(am): add health and risk center on the AM scorecard  
**Date:** 2026-09-05

## Summary

Added Health & Risk Center and account health detail on the existing AM scorecard. Reused CLASS `AmHealthRepository` / `AmHealthService` (query methods on the class, no type-only token). Did **not** rewrite `/crm/health` — `app/crm/health/page.tsx` left untouched.

## Backend

Extended CLASS `AmHealthRepository` with `loadCenterRows`, `loadSparkline`, `countOpenRisks`, `loadTeamIds`, `loadDetail`, `loadTrend`. Existing `POST /health/recompute` and `POST /health/:id/override` unchanged.

```
GET /api/crm/am/health?scope&from?&to?     view
GET /api/crm/am/health/:agencyClientId     view
```

**Center:** `hide_amounts`, `tiles` (exactly `healthy`, `watch`, `at_risk`, `critical`, `revenue_at_risk_vnd`, `open_risks` — no 5th band), sparkline last 6 ICT calendar months (missing → null), risky table (`at_risk|critical` only). Churned excluded from tiles, sparkline averages, and risky. `revenue_at_risk_vnd` = Σ `monthlyRecurringVnd` of at_risk+critical (media excluded; hidden without finance view / manage). Open risks = `COUNT(*)` from `crm_am_risks` where `status='open'` scoped (0 if table missing / 42P01). `delta_30d` = latest − ~30d prior; null if no prior.

**Detail:** score/band/as_of/version/thin_data, override (if still valid), weights, components, contribution (`points = score*weight/100`), last 4 as_of scores (null-padded), signals from thin_data / low components / override (`[]` if none). Out-of-scope GET → 404.

## Frontend

`AmHealthCenter` at `/crm/account-management/health`: exactly 6 tiles (Healthy, Watch, At Risk, Critical, Revenue at risk, Open risks). CSS sparkline bars + text series (no new chart lib). Risky table → `/health/{id}`. Scorecard link if manage.

`AmHealthDetail` at `/health/[id]`: header score/band, components table, trend, Recompute + Override if manage (existing POSTs). Empty → `—`.

360 health tab left Wave 3 placeholder; header badge already links to `/health/{id}`.

No nested `<main>`, no new packages, no KPI/CSD CSS. No hard-coded 31/10/5/2 / 185tr.

## TDD evidence

**RED** (center / util missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-health-center.spec.ts --no-coverage
# TS2339: Property 'center' does not exist on type 'AmHealthService'

$ cd services/ops-web && npx vitest run src/lib/crm/am-health-center.util.spec.ts
# Cannot find module './am-health-center.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-health.service.spec.ts --no-coverage
# 1 suite file, 7 passed (5 existing + 2 center)

$ cd services/ops-web && npx vitest run src/lib/crm/am-health-center.util.spec.ts
# 1 file, 1 passed
```

Required: tiles keys exactly healthy/watch/at_risk/critical + money/risks — no 5th band; churned not counted in any band tile (or revenue_at_risk / risky). Vitest: `AM_HEALTH_TILES` length 6; 4 band labels.

`app/crm/health/page.tsx` unchanged vs HEAD.

## Files

- `services/ptt-crm-api/src/am/am-health.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-health-center.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmHealthCenter.tsx`
- `services/ops-web/src/components/crm/am/AmHealthDetail.tsx`
- `services/ops-web/src/app/crm/account-management/health/page.tsx`
- `services/ops-web/src/app/crm/account-management/health/[id]/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; recompute/override stay `manage`.
- CLASS `AmHealthRepository` query methods; reused `AmHealthService`, `monthlyRecurringVnd`, `sumRevenueAtRisk`, `bandFromScore`.
- No type-only Nest tokens. No CSD resolve import/call.
- Scope via `amScopeSql` / `bindScopeSql`. Out-of-scope detail → 404.
- No nested `<main>`, no new npm packages, no KPI/CSD CSS. No Task 28 risk form.

## Concerns

- Center/detail UI was not exercised in a logged-in browser (worktree API/web not running here).
- Query `from` is accepted for API parity; tiles/sparkline use latest snapshots and last 6 ICT months (`to` as as-of cutoff).
- 360 Health & Risk tab remains the Wave 3 placeholder (header already deep-links to detail).
- Mockup “tín hiệu phổ biến” sidebar is not a separate center widget (signals live on detail only).

DONE_WITH_CONCERNS
