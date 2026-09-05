# Task 29 Report: CSD SLA parity (FR-025)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `f8ea7083` — feat(am): align AM SLA percent with CSD rollup  
**Date:** 2026-09-05

## Summary

One shared `csdSlaRate(rows, filter?)` computes SLA% for AM and CSD. Wave 1 dashboard `kpis.sla_overdue` stays a **count**. Health center GET adds `sla_pct: number | null` (not a 7th tile) and shows it as a muted caption under Open risks.

## Formula

```
sample = in_scope tickets with at least one due (first_response_due_at / sla_response_due_at or resolve_due_at / sla_resolution_due_at)
on_time = response_on_time AND resolve_on_time
rate = on_time / sample * 100   // null if sample === 0
```

- `response_on_time`: `first_response_at` is null **or** `<=` response due; no due → on_time
- `resolve_on_time`: resolved/closed/client_acceptance → `resolved_at`/`closed_at` `<=` resolve due; still open → `sla_status !== 'breached'`
- Optional filter `{ created_from, created_to, scope_status?: 'in_scope' }`

CSD column aliases (`sla_response_due_at`, `sla_resolution_due_at`) are accepted so CSD ticket rows can be passed through.

## Backend

- `services/ptt-crm-api/src/am/am-csd-sla.util.ts` — source of truth
- `services/ptt-crm-api/src/csd/csd-sla-rate.util.ts` — `export { csdSlaRate } from '../am/am-csd-sla.util'`
- Health `GET /api/crm/am/health` → `sla_pct` beside `tiles` (tiles still 6 keys)
- `AmHealthRepository.loadCsdSlaRows` reads `csd_tickets` in `[from, to]` joined to in-scope AM clients; missing CSD table → `[]` → `sla_pct` null
- Period: `query.from` or month-start of `to`/`asOf`; `created_to` = asOf
- Dashboard `loadSlaOverdue` / `kpis.sla_overdue` **not changed**

## Frontend

`AM_HEALTH_TILES` stays **6**. Optional caption `SLA 70%` under Open risks (`am-muted`). Empty/null sample → no caption.

## TDD evidence

**RED** (modules missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-csd-sla.util.spec.ts --no-coverage
# TS2307: Cannot find module './am-csd-sla.util'
# TS2307: Cannot find module '../csd/csd-sla-rate.util'
```

Health `sla_pct` RED: `Property 'sla_pct' does not exist on type 'AmHealthCenterResult'`.

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-csd-sla.util.spec.ts --no-coverage
# 1 suite, 2 passed
# 10-ticket fixture: 7/10 → 70; amRate === csdRate; |diff| ≤ 0.1
# empty / out_of_scope / no-due → null

$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-health.service.spec.ts src/am/am-dashboard.service.spec.ts --no-coverage
# 2 suites, 15 passed (sla_pct 70, tiles length 6, no sla_pct on tiles;
# dashboard sla_overdue unchanged)

$ cd services/ops-web && npx vitest run src/lib/crm/am-health-center.util.spec.ts
# 1 file, 2 passed (exactly 6 tiles; SLA 70% caption)
```

Shared fixture mix: 5 resolved on-time, 1 still-open on_track, 1 null first_response (on-time), 1 late response, 1 late resolve, 1 still-open breached.

## Files

- `services/ptt-crm-api/src/am/am-csd-sla.util.ts` (+ spec + fixture)
- `services/ptt-crm-api/src/csd/csd-sla-rate.util.ts`
- `services/ptt-crm-api/src/am/am-health.service.ts` (+ spec)
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-health-center.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmHealthCenter.tsx`

`.superpowers/` and `node_modules` not committed.

## Self-review

- One formula, two import paths, identical result
- Wave 1 overdue count untouched
- No 7th health tile, no new npm packages, no KPI Hub / CSD CSS, no CSD resolve rewrite
- Scope on CSD load via `amScopeSql` + AM ext join

## Concerns

- Health caption was not exercised in a logged-in browser (worktree app not running here).
- CSD reports service does not call `csdSlaRate` yet — re-export is ready for Wave 4 Reports.
- Helper period filter uses UTC date prefix of `created_at`; SQL uses `::date`. Edge tickets near midnight could differ by one day.
- SRS “mẫu nhỏ” badge when sample &lt; 5 was not in this brief and is not shown.

DONE_WITH_CONCERNS
