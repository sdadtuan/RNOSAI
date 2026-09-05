# Task 24: Work Queue (UI-AM-14)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 24, SRS UI-AM-14, BR-021
- Mockup `#page-work`
- Existing `am-tasks.service.ts` (create/accept/dismiss + unique `source+source_ref`)
- Dashboard `loadTodayWork` join: `crm_am_tasks` → `crm_am_account_ext` + `clients`
- Scope helpers: `amScopeSql` + `bindScopeSql` (copy from onboarding/contracts)
- `AmCreateMenu` already POSTs `/tasks` — do not rebuild create-from-scratch unless queue needs a small “+ Tạo” that reuses it
- `work/page.tsx` is a Wave 3 placeholder — replace
- `work/[id]` stays placeholder until Task 25 (link cards there)

## Do not

- Work item detail / escalate / waiting_client PATCH (Task 25)
- Nested `<main>`, new npm packages, KPI/CSD CSS
- Type-only Nest tokens — reuse CLASS `AmTasksRepository`
- Hard-code mockup counts (12/41/186)
- Commit `.superpowers/` or `node_modules`

## APIs (expand AmTasksService + controller)

```
GET  /api/crm/am/tasks?inbox=me|team|unassigned&scope&sla=breached&kind&status&priority
POST /api/crm/am/tasks/accept-bulk     // edit  { ids: string[] }
```

Existing POST create / accept / dismiss stay.

Caps: GET `view`; accept-bulk `edit`.

Scope every list row via ext + `amScopeSql`. Out-of-scope tasks do not appear.

### Inbox

- `me` (default): `assignee_staff_id = actor.staffId`
- `team`: assignee in team staff ids **or** (if you only have team *ids*) join the same team loader as handover (`loadTeamIds`). If team empty, return `[]` not all.
- `unassigned`: `assignee_staff_id IS NULL` and account in scope
- `all` only if `view_all`/`manage` and `inbox` omitted or `inbox=all` — optional; default stay me/team/unassigned

Exclude `dismissed_at IS NOT NULL` and status `cancelled`. Include `resolved` for board column.

### SLA / overdue (BR-021)

```ts
function amTaskOverdue(row): boolean {
  if (row.status === 'waiting_client' && row.sla_paused === true) return false;
  if (!row.sla_resolve_due_at) return false;
  return Date.parse(row.sla_resolve_due_at) < Date.now();
}
```

`sla=breached` filter uses this helper (paused waiting_client **must not** match).

`sla_clock`: remaining ms vs `sla_resolve_due_at`, or `'paused'` when waiting_client+paused, or null.

### List item

```
id, agency_client_id, account_name, title, kind, priority, status,
assignee_staff_id, assignee_label, due_at,
sla_first_due_at, sla_resolve_due_at, sla_paused, sla_clock, overdue,
source, source_ref
```

Empty names → null (UI `—`).

### Bulk accept

Reuse `accept` per UUID in `ids` (max 50). Skip missing/out-of-scope. Return `{ accepted: number, items }`. Only unassigned or already-me is OK; do not steal another assignee (409 or skip).

## UI `AmWorkQueue.tsx`

Header: Work Queue · inbox counts if cheap (or `—`) · `Giờ LV 08:30–17:30` from freshness if easy.
URL: `?inbox=&view=list|board|week&sla=&kind=&status=`
Views:
- **list**: table Pri · Việc · Account · Assignee · Status · SLA · Hạn. Click → `/crm/account-management/work/{id}`
- **board**: 4 columns New · In Progress · Waiting Client · Resolved (map statuses). Cards.
- **week**: Mon–Fri ICT of current week; tasks with `due_at` that day. No Sat/Sun columns.

Bulk: checkbox unassigned + `Nhận việc hàng loạt`.
SLA breached rows: danger pill. Paused: `Paused` not overdue.

No fake 12/41/186.

## Tests (TDD)

Jest `am-tasks.service.spec.ts` (keep existing accept/create):

1. create same open `source+source_ref` → 409 `duplicate_source_ref` (already there — keep)
2. **new:** list `sla=breached` — a `waiting_client` + `sla_paused=true` + `sla_resolve_due_at` in the past is **excluded**; an `in_progress` past due is **included**. Assert helper/SQL.

Vitest `am-work-queue.util.ts`: `amTaskOverdue` paused case; view/inbox parse; 4 board columns.

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-tasks.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-work-queue.util.spec.ts
```

## Commit

`feat(am): add work queue list, board, and week views`

HEREDOC. Never `--no-verify`. Never update git config.

## Report

`.superpowers/sdd/task-24-report.md` with RED/GREEN.

Final line: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
