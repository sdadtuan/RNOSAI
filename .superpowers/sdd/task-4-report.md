# Task 4 report — Orders + Invoices PostgreSQL cutover

## Status

Implemented Task 4 only.

- Added PostgreSQL DDL bootstrap for `crm_orders`, `crm_order_lines`, `crm_invoices`, and `crm_invoice_lines`.
- Added optional `crm_svc_payments` extensions when that table exists in PostgreSQL.
- Added PostgreSQL repositories for orders and invoices with the existing API data shapes.
- Rewired order and invoice services/modules to PostgreSQL repositories only.
- Updated the order lines controller path and service tests for asynchronous PostgreSQL access.
- Kept the SQLite repositories only as legacy source/test fixtures; runtime services and modules no longer import them.

## Verification

- `npm --prefix services/ptt-crm-api test -- src/orders src/invoices src/billing --no-coverage`
  - 5 suites passed
  - 8 tests passed
- `npm --prefix services/ptt-crm-api run build`
  - Passed
- `git diff --check -- services/ptt-crm-api/src/orders services/ptt-crm-api/src/invoices services/ptt-crm-api/src/billing`
  - Passed

## UI smoke

Not run: no local PostgreSQL instance was available on ports 5432 or 5433, and no local API/web server was running. The repository and service tests cover PostgreSQL-only wiring and list behavior, but a real UI create-order/create-draft-invoice smoke remains for an environment with PostgreSQL and staff authentication.

## Concerns

- Schema bootstrap adds payment columns only when `crm_svc_payments` already exists, as required. Invoice payment synchronization safely treats a missing payment table as zero paid.
- The requested UI creation smoke is the only unverified step.

## Commit

`Serve CRM orders and invoices from PostgreSQL only.`
# Task 4 Report: Kanban board — accent + CTA kind class

**Status:** DONE  
**Branch:** `feat/canopy-vivid-design`  
**Commits created:** none (per instructions)

---

## Summary

Wired existing Task 2 helpers into `LeadKanbanBoard` and overlay CSS only. Column `--kanban-accent` now comes from `kanbanStageAccent(stage)`. Each card still has one CTA, now classed `crm-kanban-card__cta crm-kanban-card__cta--${cta.kind}`. Band / chip / CTA colors use work-signal vars under `html.ops-shell-bitrix`. Unprefixed `.crm-kanban-card--hot` (PTT green `#17692f`) was removed so it cannot stay green.

## Files changed

| File | Action |
|------|--------|
| `services/ops-web/src/components/crm/LeadKanbanBoard.tsx` | Modified — deleted local `STAGE_ACCENT`; import + use helpers |
| `services/ops-web/src/app/bitrix-theme.css` | Modified — overlay band / chip / CTA / column-head rules |

No new CSS file. Helpers (`kanban-card-cta.ts`, `work-signals.ts`) were not rewritten. `SalesPipelineFunnelPanel` TSX was not touched.

## Step evidence

### Step 1 — visual contract (helpers + grep)

No RTL component test. Contract is the Task 2 helper lock plus class wiring.

Grep after implementation:

```
LeadKanbanBoard.tsx
  import { kanbanCardCta, kanbanStageAccent } from '@/lib/crm/kanban-card-cta';
  style={{ ['--kanban-accent' as string]: kanbanStageAccent(stage) }}
  const ctaClass = `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${cta.kind}`;

bitrix-theme.css
  html.ops-shell-bitrix .crm-kanban-card--hot { border-left-color: var(--hot); }
  html.ops-shell-bitrix .crm-kanban-card__chip--hot { ... }
  html.ops-shell-bitrix .crm-kanban-card__cta--call { ... }
  html.ops-shell-bitrix .crm-kanban-card__cta--quote { ... }
```

`STAGE_ACCENT` is gone from the board. Unprefixed `.crm-kanban-card--hot` is gone.

### Step 2 — confirmed local STAGE_ACCENT (before)

`rg "STAGE_ACCENT" services/ops-web/src/components/crm/LeadKanbanBoard.tsx` matched the local map (lines 9–21) and `STAGE_ACCENT[stage] ?? '#17692f'`.

### Step 3 — implementation

**TSX**

- Deleted `STAGE_ACCENT`.
- Import: `kanbanCardCta, kanbanStageAccent` from `@/lib/crm/kanban-card-cta`.
- Column: `kanbanStageAccent(stage)` → `--kanban-accent`.
- CTA class: `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${cta.kind}`.
- Still one CTA per card (`tel:` `<a>` xor `<Link>`). No second button.

**CSS** (`html.ops-shell-bitrix` overlay, verbatim hex/vars from brief)

- Band: `--hot` / `--warm` / `--cold`.
- Chips: hot `#ffe4e6`/`#9f1239`, warm `#ffedd5`/`#9a3412`, cold `#f1f5f9`/`#475569`, ai `#ede9fe`/`#5b21b6`, sla `#ffe4e6`/`#9f1239`.
- CTA kinds: call `--hot`, intake `--sky`, quote `--gold`, hub `--won`, lead `--ptt`.
- Hover lift + column-head `color-mix` with `--kanban-accent`.
- Removed combined unprefixed+prefixed band rules that set hot to `#17692f`. Removed unprefixed chip color rules so they cannot stay PTT green.

`SalesPipelineFunnelPanel` reuses `crm-kanban-card--*` / `__chip--*` — picks up new overlay colors without a TSX change.

### Step 4 — helper tests

```bash
cd services/ops-web && npx vitest run src/lib/crm/kanban-card-cta.spec.ts src/lib/crm/work-signals.spec.ts
```

```
RUN  v4.1.11 /Users/quoctuan/Documents/CursorAI/RNOSAI

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Duration  209ms
```

Expected PASS. Observed PASS (10 `kanban-card-cta` + 1 `work-signals`).

### Step 5 — commit

Skipped. No `git add` / `commit` / `push`.

## Self-review

### Correctness

- Helpers consumed, not duplicated. Accent hex stays locked in Task 2 (`WORK_SIGNALS`).
- CTA `kind` union includes `quote`; class interpolates that kind.
- Overlay selector is only `html.ops-shell-bitrix`. No new CSS file.
- Hot band is `var(--hot)` (`#e11d48` on the shell), not `#17692f`.
- Default card left border remains `var(--ptt, #17692f)` for unbanded cards — correct; only `--hot/--warm/--cold` override.
- One CTA per card. Title `Link` is navigation, not a second job button.
- No linter issues on `LeadKanbanBoard.tsx`.

### Specificity

Unprefixed `.crm-kanban-card--hot { border-left-color: #17692f }` was deleted (not left green). Prefixed `html.ops-shell-bitrix .crm-kanban-card--hot` is the only hot band rule.

### Concerns / follow-ups

- **Pipeline CTA is unkinded:** `SalesPipelineFunnelPanel` still uses `btn btn-sm crm-kanban-card__cta` without `--${kind}`, so deal cards get new band/chip colors but not a job-colored CTA. Brief said do not change that TSX unless band stayed green.
- **Unprefixed hover leftover:** `.crm-kanban-card:hover { border-color: rgba(23, 105, 47, 0.35); }` still tints the other three borders green. `border-left-color` on the prefixed `--hot` rule wins for the accent (higher specificity). Pre-existing; not changed.
- **Hover transition:** card `transition` is only `border-color`; the new `transform` lift will snap. Out of brief scope.
- **Vitest runner:** `npx vitest` pulled `vitest@4.1.11` (ops-web `node_modules` had no local vitest binary). Tests still passed. Prefer `npm run test:unit -- <files>` after install if CI must pin `^3.0.5`.
- **No visual/RTL test:** color wiring is CSS-only; confirmed by helper tests + grep, not a rendered screenshot.

## Git

No commits created (per task instructions).

---

## Review fix — CTA hover + card transition

**Status:** DONE (CSS only, no commit)

### What changed

`services/ops-web/src/app/bitrix-theme.css`:

1. **Lead CTA hover** — Added `html.ops-shell-bitrix .crm-kanban-card__cta--lead:hover` with `background` / `border-color: var(--ptt-deep)` (`#114d24`) so the kind rule no longer blocks brand hover. Other kind CTAs unchanged (call/intake/quote/hub keep signal colors via existing rules).
2. **Card transition** — Added `html.ops-shell-bitrix .crm-kanban-card { transition: border-color, transform, box-shadow 0.12s ease }` so hover lift/shadow animate instead of snapping.

### Test command + output

```bash
cd services/ops-web && npx vitest run src/lib/crm/kanban-card-cta.spec.ts src/lib/crm/work-signals.spec.ts
```

```
 RUN  v3.2.7 /Users/quoctuan/Documents/CursorAI/RNOSAI/services/ops-web

 ✓ src/lib/crm/work-signals.spec.ts (1 test) 2ms
 ✓ src/lib/crm/kanban-card-cta.spec.ts (10 tests) 3ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Duration  462ms
```

Expected PASS. Observed PASS (11/11).
