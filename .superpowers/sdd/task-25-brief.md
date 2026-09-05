# Task 25: Work item detail + escalate (UI-AM-15/16/18)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 25, SRS UI-AM-15/16/18
- Mockup `#page-work-detail`, `#` escalate drawer if present
- Task 24 list/get patterns in `am-tasks.service.ts` (`list`, `amTaskOverdue`, scope)
- W3 columns on `crm_am_tasks`: `csd_ticket_id`, `escalation_level`, `resolution_summary`, `resolution_category`
- Notifications table `crm_am_notifications` — add `insert` on CLASS `AmNotificationsRepository` (do not invent a type-only store)
- `CsdTicketsService.resolve` exists — **never call it**. Do **not** inject `CsdTicketsService` into AM tasks. Test asserts a mocked `resolve` is not invoked (pass a dummy `{ resolve: jest.fn() }` into the service constructor only if you add an optional unused dep — **prefer**: no CSD import at all, and the spec `expect(jest.requireMock or a spy).not` — simplest: service file must not import `../csd/` and spec `readFileSync` or `expect(service['csd']).toBeUndefined()`. Better: inject `@Optional() csd?: { resolve: ... }` that is **never called**; test constructs service with `{ resolve: jest.fn() }` and after escalate `expect(csd.resolve).not.toHaveBeenCalled()`.
- `work/[id]/page.tsx` is placeholder — replace
- Create-task modal already in `AmCreateMenu` (UI-AM-16). Do not rebuild unless a thin link.

## Do not

- Call any CSD status/resolve/update API
- Nested `<main>`, new packages, KPI/CSD CSS
- Task 26 timeline
- Commit `.superpowers/` / `node_modules`

## APIs (`edit` except GET `view`)

```
GET  /api/crm/am/tasks/:id
POST /api/crm/am/tasks/:id/waiting-client   { reason, evidence? }
POST /api/crm/am/tasks/:id/resolve          { summary, category? }
POST /api/crm/am/tasks/:id/escalate         { level, recipient_staff_id, summary, reason? }
```

GET out-of-scope → 404. Invalid UUID → 400.

### GET detail

List fields + `waiting_client_reason`, `resolution_summary`, `resolution_category`, `escalation_level`, `csd_ticket_id`, `overdue`, `sla_clock`.

`csd_href`: if `csd_ticket_id` set → `/crm/csd/tickets/{id}` else null.

### Waiting Client

- Trim `reason` required else **400 `reason_required`**
- Set `status=waiting_client`, `sla_paused=true`, `waiting_client_reason`
- `evidence` optional string stored in reason suffix or ignored (no new column) — if present append to reason as `\n\nEvidence: …`
- Audit `task.waiting_client`

### Resolve

- Trim `summary` required else **400 `summary_required`**
- If `kind` is `issue` **or** title/kind looks like complaint (`kind==='issue'` is enough) **or** `kind==='client_request'` with priority high — brief says “complaint adds category”: if `kind==='issue'` and no `category` → **400 `category_required`**
- Set `status=resolved`, `resolution_summary`, `resolution_category`, `sla_paused` unchanged
- Audit `task.resolve`

### Escalate (notify only)

- `level` in `lead|director|executive` else 400
- `recipient_staff_id` integer > 0 else 400
- `summary` required else 400
- UPDATE AM task only: `escalation_level`, optionally `kind` stays. **Do not** change CSD ticket.
- INSERT `crm_am_notifications` for `recipient_staff_id`: `kind='escalation'`, title includes account/task, `href=/crm/account-management/work/{id}`
- Suggested default level from SLA consumed vs 70/90/100 (resolve due vs created or first due) — UI can prefill; API accepts explicit level
- Audit `task.escalate`
- If optional CSD dep present, never call `resolve`

## UI `AmWorkItem.tsx`

Red banner if `overdue` (not when paused): `Resolution SLA breached` + clock.
Header: title · account · kind · priority.
Body: read-only content/title; status, assignee, SLA first/resolve, paused.
Links: CSD deep-link if `csd_href` (open in same app, not resolve button).
CTAs (`canEdit`): Chờ khách hàng (modal reason * + evidence) · Resolved (summary * + category if issue) · Escalate (level * · recipient staff id * · summary *).
Map 400 codes. After success reload.

## Tests (TDD)

1. waiting_client without reason → 400 `reason_required`; no UPDATE
2. escalate with mocked `{ resolve: jest.fn() }` **must not** call `resolve`; notification insert + `escalation_level` set
3. resolve issue without category → 400 `category_required`

Vitest: `amWorkItemBreached` true only when overdue && !paused.

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-work-item.util.spec.ts
```

## Commit

`feat(am): add work item detail, SLA pause, and escalate`

Report: `.superpowers/sdd/task-25-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
