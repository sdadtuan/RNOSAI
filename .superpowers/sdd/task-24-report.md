# Task 24 Report: Work Queue (UI-AM-14)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `49bb55f4` — feat(am): add work queue list, board, and week views  
**Date:** 2026-09-05

## Summary

Replaced the Wave 3 Work Queue placeholder with list / board / week views. Expanded `AmTasksService` (CLASS `AmTasksRepository`) with scoped `GET /tasks` and `POST /tasks/accept-bulk`. Existing create / accept / dismiss unchanged. `work/[id]` stays a placeholder for Task 25; cards link there.

## Backend

`GET /api/crm/am/tasks?inbox=me|team|unassigned&scope&sla=breached&kind&status&priority` (`view`)

- Every row joins `crm_am_tasks` → `crm_am_account_ext` + `clients` (same as dashboard `loadTodayWork`) and applies `amScopeSql` / `bindScopeSql` (copied from onboarding).
- Inbox: `me` (default) = assignee is actor; `team` = assignee in team via `loadTeamIds` + staff/team join (empty team → `[]`, not all); `unassigned` = `assignee_staff_id IS NULL`; `all` only when `view_all`/`manage` and `inbox=all`.
- Excludes `dismissed_at IS NOT NULL` and `cancelled`. Includes `resolved`.
- `sla=breached` uses `amTaskOverdue` in SQL and again in JS: `waiting_client` + `sla_paused` is never overdue.

`POST /api/crm/am/tasks/accept-bulk` (`edit`) `{ ids }` — max 50 UUIDs, reuse `accept`, skip missing / out-of-scope / another assignee. Returns `{ accepted, items }`.

List item: `id, agency_client_id, account_name, title, kind, priority, status, assignee_staff_id, assignee_label, due_at, sla_first_due_at, sla_resolve_due_at, sla_paused, sla_clock, overdue, source, source_ref`. Empty names → `null`. `sla_clock` is remaining ms, `'paused'`, or `null`. Also returns cheap inbox `counts` and `work_hours: Giờ LV 08:30–17:30`.

## Frontend

`AmWorkQueue` at `/crm/account-management/work?inbox=&view=list|board|week&sla=&kind=&status=`

- Header: Work Queue · inbox counts or `—` · `Giờ LV 08:30–17:30` (+ command-center leftover if present).
- List: Pri · Việc · Account · Assignee · Status · SLA · Hạn. Click → `/crm/account-management/work/{id}`.
- Board: New · In Progress · Waiting Client · Resolved.
- Week: Mon–Fri ICT of the current week; `due_at` that day only. No Sat/Sun.
- Bulk checkbox on unassigned + `Nhận việc hàng loạt`.
- `+ Tạo` reuses `AmCreateMenu` via `openCreate('task')`.
- Breached = danger pill. Paused = `Paused`, not overdue. No mockup 12/41/186.

## TDD evidence

**RED** (helper / list / util missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
# TS2305: Module '"./am-tasks.service"' has no exported member 'amTaskOverdue'.
# TS2339: Property 'list' does not exist on type 'AmTasksService'.

$ cd services/ops-web && node node_modules/.bin/vitest run src/lib/crm/am-work-queue.util.spec.ts
# Cannot find module './am-work-queue.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
# 1 suite, 4 passed (accept / create UUID / duplicate source_ref / sla=breached)

$ cd services/ops-web && node node_modules/.bin/vitest run src/lib/crm/am-work-queue.util.spec.ts
# 1 file, 3 passed
```

Required: create same open `source+source_ref` → 409 (kept). `waiting_client` + `sla_paused` + past `sla_resolve_due_at` excluded from `sla=breached`; `in_progress` past due included. Helper + SQL asserted. Vitest: paused overdue case, view/inbox parse, four board labels.

## Files

- `services/ptt-crm-api/src/am/am-tasks.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-work-queue.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmWorkQueue.tsx`
- `services/ops-web/src/app/crm/account-management/work/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; accept-bulk `edit`. Existing create/accept/dismiss stay `edit`.
- Reused CLASS `AmTasksRepository` (added `query`); no type-only Nest token.
- No nested `<main>`, no new npm packages, no KPI/CSD CSS, no hard-coded 12/41/186.
- Work item detail / escalate / waiting_client PATCH not implemented (Task 25).

## Concerns

- Work queue UI was not exercised in a logged-in browser (worktree API/web not running here).
- `waiting_internal` maps to In Progress; `closed` maps to Resolved so it does not land in New.
- Single `POST /tasks/:id/accept` still overwrites another assignee (pre-existing). Bulk skips those ids.

DONE_WITH_CONCERNS
