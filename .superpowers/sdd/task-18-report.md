# Task 18 Report: Onboarding workspace + template + Go-live (UI-AM-08/09)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `a680c09d` — feat(am): add onboarding workspace and go-live gate  
**Date:** 2026-09-05

## Summary

Added the onboarding case workspace, go-live gate, and template admin on top of Task 17 handover (which already inserts `crm_am_onboarding_cases` from the latest published template). Go-live is blocked when any required item is open unless override + reason. Published templates cannot be PATCHed — clone to draft. Settings page is template-only (no scorecard PUT).

## Backend

`AmOnboardingService` + CLASS `AmOnboardingRepository` + `amScopeSql` (out-of-scope case GET → 404 `not_found`):

- `GET /api/crm/am/onboarding-cases?scope&agency_client_id` (`view`)
- `GET /api/crm/am/onboarding-cases/:id` (`view`) — payload includes items, `progress_pct`, track, owner, delivery, `health_fresh_24h`, stakeholders, empty activity/documents
- `PATCH /api/crm/am/onboarding-cases/:id` (`edit`) — toggle `done`/`done_at` only; closed → 409 `case_closed`; unknown id → 400 `invalid_item_id`
- `POST /api/crm/am/onboarding-cases/:id/go-live` (`edit`) — `YYYY-MM-DD` or 400 `invalid_go_live_on`; required open + no override → 400 `required_open`; override without reason → 400 `override_reason_required`; `health_fresh_24h` does not block. Transaction: close case + `am_status='active'`; `rowCount === 0` → 409 `already_closed`. Audit `onboarding.go_live` after COMMIT
- `GET /api/crm/am/onboarding-templates` (`view`)
- `POST / PATCH / clone / publish` templates (`manage`) — PATCH published → 409 `template_published`

Item JSON: template fields + case `{ done, done_at, due_on }`. `due_on` computed from case `created_at` ICT + `due_offset_days` on GET if missing; persisted on PATCH. Non-array `items_json` → `[]`.

## Frontend

- Workspace `/crm/account-management/onboarding/[id]`: header progress / go-live / owner / delivery / track pill. Nav: Tổng quan / Checklist / Milestones / Stakeholders / Tài liệu / Activity (`?tab=`). CTA `Đánh dấu sẵn sàng Go-live`. Modal: required count, health warning `Báo cáo dashboard chưa có dữ liệu 24 giờ`, date, override + reason.
- After handover accept, if `onboarding_case_id` present → `/crm/account-management/onboarding/{id}`.
- Settings: `Cấu hình / Onboarding templates` only. Published read-only + `Nhân bản thành draft`. Draft: edit + Lưu + Xuất bản. Non-manage read-only.

## TDD evidence

**RED** (methods / module missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage
# TS2339: Property 'goLive' does not exist on type 'AmOnboardingService'
# TS2339: Property 'patchTemplate' does not exist on type 'AmOnboardingService'

$ cd services/ops-web && node node_modules/.bin/vitest run src/lib/crm/am-onboarding.util.spec.ts
# Cannot find module './am-onboarding.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage
# 1 suite, 8 passed (4 handover + 4 workspace)

$ cd services/ops-web && node node_modules/.bin/vitest run \
  src/lib/crm/am-onboarding.util.spec.ts \
  src/lib/crm/am-handover.util.spec.ts
# 2 files, 6 passed
```

Required cases: go-live required open + no override → 400 `required_open` (no UPDATE case/ext, no audit); PATCH published → 409 `template_published` (no UPDATE). Recommended: override without reason → 400 `override_reason_required`; override + reason closes case and writes `onboarding.go_live`.

## Files

- `services/ptt-crm-api/src/am/am-onboarding.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-onboarding.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmOnboarding.tsx`
- `services/ops-web/src/components/crm/am/AmSettings.tsx`
- `services/ops-web/src/components/crm/am/AmHandover.tsx` (redirect after accept)
- `services/ops-web/src/app/crm/account-management/onboarding/[id]/page.tsx`
- `services/ops-web/src/app/crm/account-management/settings/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Self-review

- Caps match brief (`view` / `edit` / `manage`).
- Reused CLASS `AmOnboardingRepository`; no type-only repo.
- No nested `<main>`, no mockup hard-codes in UI, no PUT `/api/crm/am/settings`, no KPI Hub / CSD CSS.
- Handover accept semantics unchanged except optional workspace redirect.
- `.superpowers/` and `node_modules` not committed.

## Concerns

1. **UI not browser-verified** — staff login required; verified via unit tests only.
2. **Onboarding queue still lists handovers only** — open cases are reachable after accept or by URL `/onboarding/{id}`; list API exists but has no queue table.
3. **Template list is global latest-version sort** — not grouped by name; multiple published versions can coexist (latest still wins on accept).
4. **Health warning is a red `am-banner`** — copy matches the mockup; it does not block go-live.

DONE_WITH_CONCERNS
