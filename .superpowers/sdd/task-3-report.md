# Task 3 Report: Deal Bar + 4-tab shell (S0 UI)

**Branch:** `feat/intake-deal-bar-sales-kit`  
**Status:** DONE_WITH_CONCERNS  
**Commit:** `636dab6f` — feat(crm): add intake Deal Bar and workspace tabs

## Files

| File | Change |
|------|--------|
| `services/ops-web/src/lib/crm/intake-workspace-tab.ts` | `pickDefaultIntakeTab` + `IntakeWorkspaceTab` |
| `services/ops-web/src/lib/crm/intake-workspace-tab.spec.ts` | Brief tests verbatim |
| `services/ops-web/src/components/crm/intake/IntakeDealBar.tsx` | Sticky identity + BANT + service select |
| `services/ops-web/src/components/crm/intake/IntakeWorkspaceTabs.tsx` | Qualify / Discovery / Win intel / Handoff |
| `services/ops-web/src/app/crm/intake/IntakeContent.tsx` | Resolve slug, fetch context, Deal Bar + tabs |
| `services/ops-web/src/app/globals.css` | `.intake-deal-bar`, `.intake-workspace-tabs` |

Not deleted (usage removed from main column): `IntakeLeadContextCard`, `IntakePrepSummaryCard`.

## Behavior

- `resolvedSlug = resolveIntakeServiceSlug({ urlSlug, sessionSlug, funnelSlug })`. Local Deal Bar select is `serviceOverride` (not persisted — Task 4).
- Definition load: `fetchIntakeDefinitionBySlug(access, resolvedSlug)` — no hardcoded `_common`.
- `fetchIntakeContext` when `leadId > 0`. SCI excerpt = `context.prep.pain_excerpt`.
- Default tab: `handoff` if completed; `discovery` if BANT &lt; 18; else `qualify`.
- Qualify = BANT + decision + red flags. Discovery = existing section. Win intel = muted “Sẽ mở ở S1”. Handoff = stakeholders + commitments + AI + collapsed stepper.
- Funnel stepper default collapsed; Deal Bar Funnel ▾ expands it. Help `?` opens a 4-step drawer. Toolbar subtitle: `Phiên qualify theo dịch vụ`.

## TDD Evidence

### RED — Step 2 (spec before implementation)

```text
$ cd services/ops-web && npx vitest run src/lib/crm/intake-workspace-tab.spec.ts

 FAIL  services/ops-web/src/lib/crm/intake-workspace-tab.spec.ts
Error: Cannot find module './intake-workspace-tab' imported from
  .../src/lib/crm/intake-workspace-tab.spec.ts

 Test Files  1 failed (1)
      Tests  no tests
```

Failure matches brief: module missing.

### GREEN — after tab util

```text
$ cd services/ops-web && npx vitest run src/lib/crm/intake-workspace-tab.spec.ts

 ✓ src/lib/crm/intake-workspace-tab.spec.ts (3 tests)

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

### Step 4 — both suites

```text
$ cd services/ops-web && npx vitest run \
    src/lib/crm/intake-service-resolve.spec.ts \
    src/lib/crm/intake-workspace-tab.spec.ts

 Test Files  2 passed (2)
      Tests  9 passed (9)
```

Lint: skipped — `services/ops-web/node_modules` has no local `next`; `npx next lint` pulled Next 16 and rejected `--file`.

## Self-Review

- Deal Bar props match the brief type exactly.
- All new hooks sit above `if (!authReady)`.
- Stacked lead/SCI cards and always-open stepper removed from the main column.
- Win intel is a placeholder only (Task 5). `onServiceChange` is local state only (Task 4).

## Concerns

1. **Service select does not PATCH** — `serviceOverride` only; Task 4 persists.
2. **Win intel** is muted “Sẽ mở ở S1” — no `win_intel` state (Task 5).
3. **Lint not run** — no local Next binary in this workspace.
4. **Cockpit href** is `/crm/leads/{id}` (Sales Cockpit lives on lead detail; no dedicated intake hash).

## Review fixes (Important)

**Commit:** `fix(crm): read intake URL service_slug and surface definition errors`

1. **`?service_slug=` ignored when `lead_id` already set.** `page.tsx` passes `initialLeadId` from `?lead_id=`, so the URL effect returned before reading `service_slug`. Split into its own `useEffect` that always reads `window.location.search`. Lead/lifecycle fallback unchanged. Hooks remain above `if (!authReady)`.
2. **Definition fetch errors were silent.** First failed load (no `intakeDefinition` yet) now sets `error`. A later failure keeps the definition already on screen.

Added `url slug wins over funnel` in existing `intake-service-resolve.spec.ts` (Task 0 file). Minor items not touched.

### Re-run covering tests

```text
$ cd services/ops-web && npx vitest run src/lib/crm/intake-workspace-tab.spec.ts src/lib/crm/intake-service-resolve.spec.ts

 RUN  v4.1.11 /Users/quoctuan/Documents/CursorAI/RNOSAI

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  18:01:28
   Duration  416ms (transform 121ms, setup 0ms, import 179ms, tests 15ms, environment 0ms)
```
