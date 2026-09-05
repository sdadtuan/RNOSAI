# Task 26: Timeline + log meeting (UI-AM-04/17)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 26, SRS UI-AM-04/17, mockup `#d-meet`
- Table `crm_am_interactions` (Task 23)
- `AmCreateMenu` — enable **Log tương tác** (currently disabled Wave 3)
- `AmAccount360` Log tương tác button + timeline tab (`implemented: false` → true)
- `AmTasksService.create` for ticked action items (`source=interaction`, `source_ref=interaction:{id}:{index}`)
- Scope via ext + `amScopeSql`. Out-of-scope GET → 404
- CLASS `AmInteractionsRepository` registered in `am.module.ts`

## Do not

- AI extract of action items (flag off — no auto draft)
- Nested `<main>`, new packages, KPI/CSD CSS
- Type-only Nest tokens
- Call CSD resolve
- Commit `.superpowers/` / `node_modules`

## APIs

```
GET   /api/crm/am/interactions?agency_client_id&scope     view
POST  /api/crm/am/interactions                            edit
PATCH /api/crm/am/interactions/:id                        edit
```

`agency_client_id` required UUID on list else 400.

### Row

```
id, agency_client_id, kind, occurred_at, actor_staff_id, summary,
sentiment, visibility, attendees, action_items, created_at, editable
```

`editable` = `kind !== 'system'`.

System rows: either stored `kind='system'` or synthesized read-only from `crm_am_audit` for this client (`action` like `health.%`, `handover.%`, `account.transfer`) — **do not allow PATCH**. If synthesizing, `id` can be `audit:{id}`.

### POST body

```
{
  agency_client_id, kind: note|call|meeting|email,
  occurred_at, summary, sentiment?, visibility?,
  attendees?: string[],
  action_items?: Array<{ title: string; done?: boolean; due_at?: string }>
}
```

- `kind` cannot be `system` on POST → 400 `system_readonly`
- `summary` required
- `kind==='meeting'`: `attendees` ≥1 non-empty else **400 `attendees_required`**
- After INSERT, for each action_item with `done===true` and title: `tasks.create({ agency_client_id, title, source: 'interaction', source_ref: 'interaction:{id}:{i}' })`
- Audit `interaction.create`

### PATCH

- Load scoped. If `kind==='system'` **or** id starts with `audit:` → **409 `system_readonly`** (test name: “system kind cannot PATCH”)
- May update summary/sentiment/visibility/attendees/action_items for human kinds only
- Do not change kind to system

## UI

`AmTimeline.tsx` used by 360 tab `timeline` (mark implemented) and create-menu drawer.

Composer kinds: note / call / meeting / email. Fields: time, attendees * if meeting, summary *, sentiment, visibility, action items (checkbox + title). Save → POST. Ticked items become tasks.

Feed: newest first. System rows: muted, no edit. Human rows: show summary; no inline edit required (PATCH exists for tests).

Enable:
- `AmCreateMenu` Log tương tác (need `agency_client_id` — pick from book like task create)
- 360 header button opens composer for this account
- Extend `AmCreateKind` with `'interaction'`

## Tests (TDD)

Jest `am-interactions.service.spec.ts`:

1. PATCH `kind=system` → 409 `system_readonly`; no UPDATE
2. POST meeting with one ticked action item → INSERT interaction **and** `tasks.create` called with `source='interaction'`

Vitest: meeting without attendees → error helper; system `editable===false`.

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-interactions.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-timeline.util.spec.ts
```

## Commit

`feat(am): add account timeline and meeting log`

Report: `.superpowers/sdd/task-26-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
