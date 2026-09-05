# Task 26 Report: Timeline + log meeting (UI-AM-04/17)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `6e7e6d76` — feat(am): add account timeline and meeting log  
**Date:** 2026-09-05

## Summary

Added account timeline and meeting/interaction log. New CLASS `AmInteractionsRepository` + `AmInteractionsService` registered in `am.module.ts`. Reused `AmTasksService.create` for ticked action items (`source=interaction`, `source_ref=interaction:{id}:{index}`). Enabled **Log tương tác** in `AmCreateMenu` and `AmAccount360`. Marked the 360 `timeline` tab `implemented: true`.

## Backend

`AmInteractionsService` + CLASS `AmInteractionsRepository` (query store, not a type-only Nest token).

```
GET   /api/crm/am/interactions?agency_client_id&scope     view
POST  /api/crm/am/interactions                            edit
PATCH /api/crm/am/interactions/:id                        edit
```

- List requires `agency_client_id` UUID else 400 (`agency_client_id_required` / `invalid_agency_client_id`).
- Scope via `crm_am_account_ext` + `amScopeSql` / `bindScopeSql`. Out-of-scope GET → 404 `not_found`.
- Row: `id, agency_client_id, kind, occurred_at, actor_staff_id, summary, sentiment, visibility, attendees, action_items, created_at, editable`.
- `editable` = `kind !== 'system'`.
- System rows: stored `kind='system'` **or** synthesized from `crm_am_audit` for this client (`health.%`, `handover.%`, `account.transfer`). Synthesized `id` is `audit:{id}`. Newest first.

**POST** `{ agency_client_id, kind: note|call|meeting|email, occurred_at, summary, sentiment?, visibility?, attendees?, action_items? }`

- `kind=system` → 400 `system_readonly`
- `summary` required else 400 `summary_required`
- `kind==='meeting'`: attendees ≥1 non-empty else 400 `attendees_required`
- After INSERT, each action_item with `done===true` and title → `tasks.create({ agency_client_id, title, source: 'interaction', source_ref: 'interaction:{id}:{i}' })`
- Audit `interaction.create`

**PATCH**

- Load scoped. `kind==='system'` or id starts with `audit:` → **409 `system_readonly`** (no UPDATE).
- May update summary/sentiment/visibility/attendees/action_items for human kinds only. Kind cannot become system.

## Frontend

`AmTimeline.tsx` used by 360 tab `timeline` and create-menu / 360 drawers.

- Composer kinds: note / call / meeting / email. Fields: time, attendees * if meeting, summary *, sentiment, visibility, action items (checkbox + title). Save → POST. Ticked items become tasks.
- Feed newest first. System rows muted, labeled System, no edit. Human rows show summary.
- `AmCreateKind` extended with `'interaction'`.
- `AmCreateMenu` **Log tương tác** enabled; picks `agency_client_id` from book like task create.
- 360 header **Log tương tác** opens composer for this account.
- Timeline tab marked implemented (no Wave 3 placeholder).
- No AI extract (flag off). No nested `<main>`, no new packages, no KPI/CSD CSS.

## TDD evidence

**RED** (modules / flag missing):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-interactions.service.spec.ts --no-coverage
# TS2307: Cannot find module './am-interactions.service'

$ cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts src/lib/crm/am-account-360.util.spec.ts
# Cannot find module './am-timeline.util'
# expected implemented tabs ['overview','finance','audit'] ≠ ['overview','timeline','finance','audit']
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-interactions.service.spec.ts --no-coverage
# 1 suite, 2 passed

$ cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts src/lib/crm/am-account-360.util.spec.ts
# 2 files, 7 passed
```

Required: PATCH `kind=system` → 409 `system_readonly`, no UPDATE. POST meeting with one ticked action item → INSERT `crm_am_interactions` **and** `tasks.create` with `source='interaction'`. Vitest: meeting without attendees → error helper; system `editable===false`.

## Files

- `services/ptt-crm-api/src/am/am-interactions.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-timeline.util.ts` (+ spec)
- `services/ops-web/src/lib/crm/am-account-360.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmTimeline.tsx`
- `services/ops-web/src/components/crm/am/AmCreateMenu.tsx`
- `services/ops-web/src/components/crm/am/AmAccount360.tsx`
- `services/ops-web/src/components/crm/am/AmShell.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; POST/PATCH `edit`.
- CLASS `AmInteractionsRepository` registered in `am.module.ts`. Reused CLASS `AmTasksService.create`.
- No type-only Nest tokens. No CSD resolve import/call.
- Scope reused from prior AM tasks. Out-of-scope GET → 404.
- No nested `<main>`, no new npm packages, no KPI/CSD CSS. No AI action-item extract.

## Concerns

- Timeline / composer UI was not exercised in a logged-in browser (worktree API/web not running here).
- Composer action items are checkbox + title only (no due/owner picker). `due_at` is accepted by the API if sent.
- Synthesized audit rows use `audit:{id}` and `action` (plus payload reason when present) as summary; PATCH of those ids is 409.

DONE_WITH_CONCERNS
