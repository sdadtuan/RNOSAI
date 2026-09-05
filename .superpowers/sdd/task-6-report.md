# Task 6 Report: Nhận việc + Tạo việc

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `64a8bf44` — feat(am): claim today work items and create AM tasks  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am-tasks.service.ts` | Created — `AmTasksRepository` + `AmTasksService` (`create` / `accept` / `dismiss`) |
| `services/ptt-crm-api/src/am/am-tasks.service.spec.ts` | Created — accept + duplicate `source_ref` (TDD first) |
| `services/ptt-crm-api/src/am/am.controller.ts` | Modified — `POST /api/crm/am/tasks`, `tasks/dismiss`, `tasks/:id/accept` + `RequireAmAction('edit')` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — register repo + service |
| `services/ops-web/src/lib/crm/am-api.ts` | Modified — `acceptAmTask` / `createAmTask` |
| `services/ops-web/src/components/crm/am/AmDashboard.tsx` | Modified — **Nhận xử lý** → toast → refetch command-center |
| `services/ops-web/src/components/crm/am/AmCreateMenu.tsx` | Modified — Việc drawer (UI-AM-16 subset) posts `POST /api/crm/am/tasks` |
| `services/ops-web/src/app/crm/account-management/am.css` | Modified — form field styles |

**Not done (out of scope):** create client/plan (Task 7), palette ⌘K (Task 8). `.superpowers/` not committed.

## TDD evidence

### RED — Step 1: spec before service

Wrote `am-tasks.service.spec.ts` before `am-tasks.service.ts` existed.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage

FAIL src/am/am-tasks.service.spec.ts
  ● Test suite failed to run

    error TS2307: Cannot find module './am-tasks.service' or its corresponding type declarations.
```

Failure reason matches the brief: module/exports missing, not a typo.

### GREEN — implement + pass

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage

PASS src/am/am-tasks.service.spec.ts
  AmTasksService
    ✓ accept assigns current staff and writes audit
    ✓ rejects duplicate open source_ref

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
```

Brief assertions: `assignee_staff_id === 42`, `status === 'in_progress'`, `audit.calls[0].action === 'task.accept'`; duplicate open `source_ref` → `{ status: 409 }`.

## Behavior

- `POST /api/crm/am/tasks` — `{ agency_client_id, title, kind?, priority?, due_at?, source?, source_ref? }`, cap `edit`. Duplicate open `(source, source_ref)` → 409 (`ConflictException`). Unique index still allows a later task after dismiss/close/cancel.
- `POST /api/crm/am/tasks/:id/accept` — `assignee_staff_id = me`, `status = in_progress`, audit `task.accept`. Drops command-center cache.
- `POST /api/crm/am/tasks/dismiss` — `{ source, source_ref }` sets `dismissed_at = now()`.
- Dashboard **Nhận xử lý** (when `can_accept` + `edit`) calls accept, toast `Đã nhận việc`, `retry()` refetches command-center.
- Create menu **Việc** drawer: loại, account (`my_book` or id), title, priority, due → `POST /api/crm/am/tasks`, toast `Đã tạo việc`, refetch. Khách / Renewal/Plan remain Task 7 stubs.

## Self-review

| Area | Assessment |
|------|------------|
| Caps | All three writes use `@RequireAmAction('edit')` |
| Unique source_ref | Pre-check + 23505 → 409; partial unique index excludes dismissed/closed/cancelled |
| Audit | `task.accept` written on accept; dismiss writes `task.dismiss` |
| Cache | `dashboard.dropCache()` after accept/create/dismiss so refetch is not stale |
| Scope creep | No client/plan create, no ⌘K |

## Concerns

- Create-work account picker uses command-center `my_book` only; empty book falls back to raw `agency_client_id` text.
- UI-AM-16 subset omits description, assignee picker, SLA, links, watchers, files.
- Accept/create not exercised in a logged-in browser this task (staff auth required).
- `create` takes `staffId` for API symmetry but does not write a create audit row (brief only required `task.accept`).

## Fix: UUID validation on write paths

**Problem:** `POST /tasks` and `accept` cast `$n::uuid` without validating. Non-UUID `agency_client_id` or task `:id` → Postgres `22P02` → 500.

**Change:** `AmTasksService.create` rejects non-UUID `agency_client_id` with `BadRequestException({ error: 'invalid_agency_client_id' })` before DB. `AmTasksService.accept` rejects non-UUID `:id` with `{ error: 'invalid_task_id' }` and `staffId <= 0` with `{ error: 'invalid_staff_id' }` before querying.

**Tests:**

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage

PASS src/am/am-tasks.service.spec.ts
  AmTasksService
    ✓ accept assigns current staff and writes audit
    ✓ rejects non-UUID agency_client_id
    ✓ rejects duplicate open source_ref

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

**Commit:** `fix(am): reject non-UUID ids on AM task write paths`
