# Task 25 Report: Work item detail + escalate (UI-AM-15/16/18)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `4c6197d0` — feat(am): add work item detail, SLA pause, and escalate  
**Date:** 2026-09-05

## Summary

Replaced the `work/[id]` placeholder with work-item detail, waiting-client SLA pause, resolve, and notify-only escalate. Reused Task 24 list scope (`amScopeSql` / `bindScopeSql` + `crm_am_account_ext`). Added `insert` on CLASS `AmNotificationsRepository`. Optional unused `{ resolve }` dummy is injected; escalate never calls it and does not import `../csd/`.

## Backend

`GET /api/crm/am/tasks/:id` (`view`) — same scoped join as list. Invalid UUID → 400 `invalid_task_id`. Out of scope / missing → 404 `not_found`.

Detail = list fields + `waiting_client_reason`, `resolution_summary`, `resolution_category`, `escalation_level`, `csd_ticket_id`, `overdue`, `sla_clock`, `csd_href` (`/crm/csd/tickets/{id}` or null), `suggested_escalation_level` (70/90/100 of created→resolve window), `created_at`.

`POST /api/crm/am/tasks/:id/waiting-client` (`edit`) `{ reason, evidence? }`

- Trim `reason` required else **400 `reason_required`** (no UPDATE).
- `status=waiting_client`, `sla_paused=true`, reason stored; evidence appended as `\n\nEvidence: …`.
- Audit `task.waiting_client`.

`POST /api/crm/am/tasks/:id/resolve` (`edit`) `{ summary, category? }`

- Trim `summary` required else **400 `summary_required`**.
- `kind==='issue'` and no category → **400 `category_required`** (no UPDATE).
- `status=resolved`, summary + category; `sla_paused` unchanged.
- Audit `task.resolve`.

`POST /api/crm/am/tasks/:id/escalate` (`edit`) `{ level, recipient_staff_id, summary, reason? }`

- `level` in `lead|director|executive` else 400 `invalid_level`.
- `recipient_staff_id` integer > 0 else 400 `invalid_recipient_staff_id`.
- Trim `summary` required else 400 `summary_required`.
- UPDATE AM task `escalation_level` only. Kind/status/CSD unchanged.
- INSERT `crm_am_notifications` (`kind='escalation'`, title includes account/task, `href=/crm/account-management/work/{id}`).
- Audit `task.escalate`.
- Optional `@Optional() @Inject('AM_CSD_RESOLVE') csd?: { resolve }` is never called.

## Frontend

`AmWorkItem` at `/crm/account-management/work/{id}`.

- Red banner only when `amWorkItemBreached` (`overdue && !paused`): `Resolution SLA breached` + clock.
- Header: title · account · kind · priority.
- Body: read-only title/content; status, assignee, first/resolve SLA, paused.
- CSD deep-link via `csd_href` (same app). Not a resolve button.
- CTAs (`canEdit`): Chờ khách hàng (reason * + evidence) · Resolved (summary * + category if issue) · Escalate (level * · recipient staff id * · summary *). Escalate highlighted when breached.
- Maps 400 codes. After success reloads.
- Create-task stays `AmCreateMenu` (UI-AM-16). No nested `<main>`, no new packages, no KPI/CSD CSS.

## TDD evidence

**RED** (methods / util missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
# TS2339: Property 'waitingClient' does not exist on type 'AmTasksService'.
# TS2554: Expected 3-4 arguments, but got 6.
# TS2339: Property 'escalate' does not exist on type 'AmTasksService'.
# TS2339: Property 'resolve' does not exist on type 'AmTasksService'.

$ cd services/ops-web && npx vitest run src/lib/crm/am-work-item.util.spec.ts
# Cannot find module './am-work-item.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
# 1 suite, 7 passed

$ cd services/ops-web && npx vitest run src/lib/crm/am-work-item.util.spec.ts
# 1 file, 2 passed
```

Required: waiting_client without reason → 400 `reason_required`, no UPDATE. Escalate with mocked `{ resolve: jest.fn() }` does not call `resolve`; notification insert + `escalation_level` set. Resolve issue without category → 400 `category_required`. Vitest: `amWorkItemBreached` true only when overdue && !paused.

## Files

- `services/ptt-crm-api/src/am/am-tasks.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-notifications.service.ts` (`insert` on CLASS)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-work-item.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmWorkItem.tsx`
- `services/ops-web/src/app/crm/account-management/work/[id]/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; waiting-client / resolve / escalate `edit`.
- Reused CLASS `AmTasksRepository.query` and CLASS `AmNotificationsRepository.insert`. No type-only Nest store.
- No `CsdTicketsService` import; optional dummy `{ resolve }` unused.
- Scope reused from Task 24. Timeline / comments / action items left for Task 26.
- No nested `<main>`, no new npm packages, no KPI/CSD CSS.

## Concerns

- Work item UI was not exercised in a logged-in browser (worktree API/web not running here).
- Escalate recipient is a numeric staff id field (no staff picker).
- Optional CSD token `AM_CSD_RESOLVE` has no module provider (stays undefined in Nest); tests pass the dummy in the constructor.

DONE_WITH_CONCERNS
