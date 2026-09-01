# Task 2 Report: Wire Planner + Presales to allow util (P0)

**Status:** Complete  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Date:** 2026-09-01

## Summary

Wired `assertPlannerAllowed` + `throwPlannerAllowResult` into all MKT AI services that previously duplicated slug/pilot checks. Removed legacy dual throws (`mkt_ai_pilot_slug_required`, `mkt_ai_planner_slug_not_pilot`). Policy remains `null` until Task 4.

## Changes

### Util (`mkt-ai-planner-allow.util.ts`)
- Added `throwPlannerAllowResult(allowed)` — maps `mkt_ai_planner_disabled` → `NotFoundException`, all other errors → `ForbiddenException` with `{ error, message, admin_path, service_slug }`.

### Services wired
| File | Method |
|------|--------|
| `marketing-ai-planner.service.ts` | `assertEnabled` |
| `leads-funnel.service.ts` | `assertPresalesMktAiEnabled` |
| `marketing-ai-dashboard.service.ts` | `assertEnabled` |
| `marketing-ai-optimize.service.ts` | `assertEnabled` |
| `marketing-ai-weekly-memo.service.ts` | `assertEnabled` |
| `marketing-ai-kpi-closed-loop.service.ts` | `assertEnabled` |
| `portal-mkt-ai-summary.service.ts` | `assertPlannerSlug` |

### Error shape (403 slug errors)
```json
{
  "error": "mkt_ai_service_not_enabled",
  "message": "Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.",
  "admin_path": "/crm/admin/mkt-ai/playbooks?slug=<slug>",
  "service_slug": "<slug>"
}
```

### Presales behavior change
- `assertPresalesMktAiEnabled` now throws `NotFoundException` (was `ServiceUnavailableException`) when planner module is off — aligned with planner service.

## Tests

```
cd services/ptt-crm-api && npx jest --testPathPattern='marketing-ai-planner|leads-funnel' --no-coverage
→ 58 suites, 225 tests PASS
```

Spec updates:
- Added pilot/env slug config to planner, dashboard, optimize service specs.
- Fixed planner service spec constructor (20 deps) + disabled-feature stubs.
- Stabilized dashboard spec date window via `resolveDashboardDateWindow` spy.

## Commit

```
feat(mkt-ai): P0 wire single allow error for planner + presales
```

## Concerns / follow-ups

1. **Policy still `null`** — Task 4 will wire DB playbook policy; until then env slugs + pilot flags govern access.
2. **P0 VPS hotfix** — PO may need `quang-cao-facebook` in `PTT_MKT_AI_PLANNER_SLUGS` if env list is non-empty and slug missing from pilot list.
3. **Presales 503→404** — clients parsing `ServiceUnavailableException` for disabled planner on presales path should migrate to 404 `mkt_ai_planner_disabled`.
