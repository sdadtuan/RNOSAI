# Task 28 Report: Risk + Recovery (UI-AM-21/22, BR-020)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `ee5e254e` — feat(am): add risk register and mandatory Critical recovery  
**Date:** 2026-09-05

## Summary

Added CLASS `AmRisksRepository` + `AmRisksService` (registered in `am.module.ts`, no type-only Nest token). Care-plan create is gated by BR-020: latest snapshot effective band Critical and no open recovery → **409 `recovery_required`** unless `crm_am` manage **and** non-empty `override_reason`. 360 GET and health detail expose `recovery_required`. 360 **Tạo rủi ro** is enabled.

## Backend

```
GET    /api/crm/am/risks?agency_client_id&scope          view
POST   /api/crm/am/risks                                 edit
GET    /api/crm/am/recovery-plans?agency_client_id       view
POST   /api/crm/am/recovery-plans                        edit
POST   /api/crm/am/recovery-plans/:id/close              edit  { outcome, lesson }
```

- Risk POST: `evidence` required (400 `evidence_required`); `severity` in `low|medium|high|critical`; audit `risk.create`.
- Recovery POST: `goal` required; `status=open`; audit `recovery.create`.
- Close: blank lesson → **400 `lesson_required`** (no closed UPDATE); both outcome+lesson required; already closed → 409 `already_closed`.
- Helper `assertCriticalRecovery(agencyClientId, { override_reason?, manage? })` uses ICT today for override-until; hooked in `AmPlansService.create` when `kind==='care'`.
- Scope via ext + `amScopeSql`. Out-of-scope → 404.

## Frontend

`AmRiskForm` drawer: category, severity, P×I, evidence *, owner, due; optional “Tạo recovery” with goal *. 360 banner + enabled Tạo rủi ro. Health detail blocking banner + Tạo recovery link. Manage users can pass `override_reason` on care-plan create.

No nested `<main>`, no new packages, no KPI/CSD CSS. Did not auto-close CSD.

## TDD evidence

**RED** (modules / 4th constructor arg missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-risks.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage
# TS2307: Cannot find module './am-risks.service'
# TS2554: Expected 2-3 arguments, but got 4

$ cd services/ops-web && npx vitest run src/lib/crm/am-risk.util.spec.ts
# Cannot find module './am-risk.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-risks.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage
# 2 suites, 8 passed (Critical+no recovery → 409, no INSERT;
# close without lesson → 400 lesson_required; care plan ok with open recovery)

$ cd services/ops-web && npx vitest run src/lib/crm/am-risk.util.spec.ts
# 1 file, 1 passed
```

Related still green: `am-accounts-360.spec.ts`, `am-health.service.spec.ts`.

## Files

- `services/ptt-crm-api/src/am/am-risks.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-plans.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-accounts.service.ts`
- `services/ptt-crm-api/src/am/am-health.service.ts`
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-risk.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmRiskForm.tsx`
- `services/ops-web/src/components/crm/am/AmAccount360.tsx`
- `services/ops-web/src/components/crm/am/AmHealthDetail.tsx`
- `services/ops-web/src/components/crm/am/AmCreateMenu.tsx`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; writes `edit`. Override still requires manage + reason.
- CLASS repository query methods; no type-only Nest tokens.
- Scope via `amScopeSql`. Out-of-scope → 404.
- No nested `<main>`, no new npm packages, no KPI/CSD CSS. No CSD auto-close.

## Concerns

- UI was not exercised in a logged-in browser (worktree API/web not running here).
- No dedicated close-recovery screen (API only). GET lists are available but not a 360 table widget.
- Optional `AmAccountsService.patch` lifecycle→`active` gate was not added; required path is care-plan per brief.

DONE_WITH_CONCERNS
