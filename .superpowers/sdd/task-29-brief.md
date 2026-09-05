# Task 29: CSD SLA parity (FR-025)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read plan Task 29. Wave 1 dashboard tile **stays overdue count**. Wave 3 adds optional SLA **percent** on Health (and ready for Reports).

```
sample = CSD in_scope tickets created in period with a due (response or resolve)
on_time = response_on_time AND resolve_on_time
rate = on_time / sample * 100   // null if sample === 0
```

`response_on_time` = `first_response_at` is null **or** `<= first_response_due_at` (if no due, treat response as on_time).
`resolve_on_time` = if status in resolved/closed/client_acceptance: `resolved_at`/`closed_at` <= `resolve_due_at`; if still open: `sla_status !== 'breached'`.

Keep this in **one** function `csdSlaRate(rows)`:

- File: `services/ptt-crm-api/src/am/am-csd-sla.util.ts`
- Re-export from `services/ptt-crm-api/src/csd/csd-sla-rate.util.ts` (`export { csdSlaRate } from '../am/am-csd-sla.util'`) so AM and CSD share one formula.

Filter type:

```
{ created_from, created_to, scope_status?: 'in_scope' }
```

Helper itself filters `scope_status === 'in_scope'` and requires at least one due (`first_response_due_at` or `resolve_due_at`).

Health center GET: add `sla_pct: number | null` (hidden/optional tile text, not a 7th KPI tile — show under Open risks or as muted caption). Do **not** add a 7th tile.

Do not change Wave 1 `kpis.sla_overdue` meaning.

## Tests (TDD)

Shared 10-ticket fixture in `am-csd-sla.util.spec.ts`:
- 10 in_scope with dues
- Mix of on_time / late response / late resolve / still-open breached
- `import { csdSlaRate as amRate } from './am-csd-sla.util'`
- `import { csdSlaRate as csdRate } from '../csd/csd-sla-rate.util'`
- `expect(amRate(fix)).toBe(csdRate(fix))`
- `expect` difference ≤ 0.1 (they should be identical)
- Document expected numeric rate (e.g. 7/10 → 70)

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-csd-sla.util.spec.ts --no-coverage
```

## Do not

- New npm packages, KPI Hub CSS, CSD resolve
- Rewrite CSD ticket engine
- Commit `.superpowers/` / `node_modules`

## Commit

`feat(am): align AM SLA percent with CSD rollup`

Report: `.superpowers/sdd/task-29-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
