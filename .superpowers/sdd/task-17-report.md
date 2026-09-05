# Task 17 Report: Sales→AM Handover (UI-AM-07)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `b10cee85` — feat(am): add Sales-to-AM handover workspace  
**Date:** 2026-09-05

## Summary

Replaced the Wave 2 onboarding placeholder with a handover queue and 4-step AM workspace (Thương mại → Scope & KPI → Stakeholder → Xác nhận). Accept requires the three AM checklist ticks. Reject / needs_info require a reason. Accept sets `am_status=onboarding`, snapshots a published onboarding template (or `[]`), and writes audit `handover.accept`.

## Backend

`AmOnboardingService` + CLASS/JWT + `amScopeSql` (out-of-scope → 404):

- `GET /api/crm/am/handovers?scope&agency_client_id&status` (`view`) — default queue `pending_am,needs_info`. Missing row for a scoped `agency_client_id` inserts `pending_am`.
- `GET /api/crm/am/handovers/:id` (`view`) — UUID 400 `invalid_handover_id`.
- `POST /api/crm/am/handovers/:id/accept` (`edit`) — checklist keys `understood_scope`, `stakeholders_access`, `delivery_owner` all true or 400 `checklist_required`. Updates handover `accepted`, ext `am_status=onboarding`, inserts `crm_am_onboarding_cases` from latest `published` template (else empty checklist). Audit `handover.accept`.
- `POST /api/crm/am/handovers/:id/reject` and `/needs-info` (`edit`) — blank reason → 400 `reason_required`. Non-pending → 409 `handover_not_pending`.

## Frontend

- Queue at `/crm/account-management/onboarding` (`?agency_client_id=` / `?handover=`).
- `AmHandover` modal: 4 steps, required AM checklist, CTAs Yêu cầu bổ sung / Từ chối / Xác nhận nhận bàn giao. CLASS tokens (`am-btn`, `am-widget`, `am-table`, `am-banner`).

## TDD evidence

**RED** (modules missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage
# TS2307: Cannot find module './am-onboarding.service'

$ cd services/ops-web && node node_modules/.bin/vitest run src/lib/crm/am-handover.util.spec.ts
# Cannot find module './am-handover.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-onboarding.service.spec.ts \
  src/am/am-accounts-360.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts \
  src/am/am-tasks.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# 6 suites, 35 passed

$ cd services/ops-web && node node_modules/.bin/vitest run \
  src/lib/crm/am-handover.util.spec.ts \
  src/lib/crm/am-account-form.util.spec.ts \
  src/lib/crm/am-account-360.util.spec.ts
# 3 files, 14 passed
```

Required cases: accept without checklist → 400 `checklist_required`; reject without reason → 400 `reason_required`; accept writes audit `handover.accept`.

## Files

- `services/ptt-crm-api/src/am/am-onboarding.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-handover.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmHandover.tsx`
- `services/ops-web/src/app/crm/account-management/onboarding/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Concerns

1. **UI not browser-verified** — staff login required; verified via unit tests only.
2. **Accept is not a DB transaction** — handover/status/case writes are sequential; a mid-flight failure can leave `accepted` without a case.
3. **Template pick is global latest published** — not industry/package-specific (Task 18).
4. **Sales cannot edit commercial/scope here** — AM review is read-only JSON; no Sales send/resubmit API in this task.
5. **Queue auto-inserts `pending_am`** when opening `?agency_client_id=` with no handover row.
6. **`onboarding/[id]` remains a Wave 2 placeholder** — accept does not navigate to the case workspace (Task 18).
