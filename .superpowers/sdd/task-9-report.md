# Task 9 Report: Health snapshot + recompute

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `7f85fa21` — feat(am): compute 4-band health snapshots for dashboard  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am-health.service.ts` | Created — Wave 1 stubs + upsert `ON CONFLICT (tenant_id, agency_client_id, as_of)` |
| `services/ptt-crm-api/src/am/am-health.service.spec.ts` | Created — weights 30/20/20/15/15; score 72 → watch; churned excluded |
| `services/ptt-crm-api/src/am/am-settings.service.ts` | Created — `GET` settings for all viewers (weights/bands/quota) |
| `services/ptt-crm-api/src/am/am.controller.ts` | Modified — `POST /health/recompute` `@RequireAmAction('manage')`; `GET /settings` `@RequireAmAction('view')` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — register `AmHealthRepository` + `AmHealthService` + settings (class tokens) |

**Not done (out of scope):** nightly 02:00 ICT job (Wave 2); Critical → recovery plan (Wave 3); settings write / notify stub / freshness chip (Task 10). `.superpowers/` not committed.

## TDD evidence

### RED — spec before service

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-health.service.spec.ts --no-coverage

FAIL src/am/am-health.service.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module './am-health.service' or its corresponding type declarations.
```

Failure reason matches the brief: module/exports missing, not a typo.

### GREEN

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-health.service.spec.ts --no-coverage

PASS src/am/am-health.service.spec.ts
  AmHealthService
    ✓ uses weights 30/20/20/15/15 and scores 72 as watch
    ✓ excludes churned clients from snapshots and dist
    ✓ upserts snapshots on conflict of tenant, client, and as_of

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Brief assertions: `DEFAULT_WEIGHTS` 30/20/20/15/15; Active contract + no CSD breach → components 70/70/80/70/70 → score **72** → band **watch**; churned not upserted and not in `dist`; SQL has `ON CONFLICT (tenant_id, agency_client_id, as_of)`.

## Behavior

- Wave 1 stubs: `kpi_delivery` 70 + thin_data; `engagement` 70 + thin_data; `financial` 80 if Active/renewing contract else 70; `satisfaction` 70; `contract_support` 40 if any in-scope CSD `sla_status=breached` else 70.
- Account `am_status=active` and `created_at` &lt; 30 days → `thin_data=true`. Wave 1 also sets `thin_data=true` because KPI/engagement are always stubbed.
- Churned (and other non-active-book statuses) skipped. Critical does **not** open a recovery plan.
- `POST /api/crm/am/health/recompute` — cap `manage`. Optional body `{ as_of }`. Upserts snapshots, drops dashboard cache, audits `health.recompute`.
- `GET /api/crm/am/settings` — cap `view`. Returns weights, bands, quota, watch window, drop alert, rollup flag. Defaults if table missing.
- Repositories injected as **class** tokens (`AmHealthRepository`, `AmSettingsRepository`), not type-only interfaces.

## Concerns

- No live Postgres proof this session — list/upsert paths are mocked in the spec; missing `crm_contracts` / `csd_tickets` degrade to no-contract / no-breach.
- `pending_handover` is skipped via `isActiveBook` (same filter as command-center `health_dist`), not only `churned`.
- No recompute button in ops-web this task; dashboard already reads latest snapshot.
- `GET /settings` landed here (small). Notify stub + freshness chip remain Task 10.
