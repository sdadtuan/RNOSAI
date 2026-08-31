# Task 4 Report: Consult-gate Win (flag)

**Status:** DONE  
**Branch:** `feat/intake-win-score-phase2`  
**Commit:** `4b607587` — feat(crm): block Consult when Win intel thin if flag on  
**Pushed:** no

## What shipped

Consult advance now overlays a Win-intel gate **after** Phase 1 BANT, only when `PTT_INTAKE_WIN_GATE === '1'` and `decision === 'go'`. Thin Win intel or checklist below 18 **blocks** and overrides a BANT warn. Flag unset/`0` keeps Phase 1.

| File | Role |
|------|------|
| `services/ptt-crm-api/src/intake/intake-win-score.util.ts` | `intakeWinGateEnabled()` (`=== '1'`). Reused existing `parseWinIntel` / checklist helpers. |
| `services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.ts` | `answers_json` on session row; Phase 1 extracted; Win overlay after `base`. |
| `services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.spec.ts` | 4 Phase 1 tests kept; 3 flag cases; env restore. |
| `services/ptt-crm-api/src/leads-funnel/leads-funnel-pg.repository.ts` | `SELECT … answers_json` in `buildConsultAdvanceGate`. |

Did **not** change `GO_THRESHOLDS`, Phase 1 messages when flag off, or `lifecycle-consult.util` `consultGateLevel`.

## Step checklist

- [x] **Step 1: Tests** — 4 old cases (flag OFF default). Added: flag ON + empty → `ok===false` `/Win intel|Win /`; flag ON + 3 confirmed intel (≥8) + checklist 18 → `ok===true`; flag OFF + empty + bant 26 → `ok===true`.
- [x] **Step 2: jest RED then GREEN** — see TDD Evidence.
- [x] **Step 3: SELECT answers_json + pass into validate** — column added; sessions typed and passed through unchanged.
- [x] **Step 4: Commit** — `4b607587` (4 files).

## TDD Evidence

### RED

Added `answers_json?` to `IntakeSessionGateRow` so the suite compiles (ts-jest rejected the new fixtures otherwise). Gate logic still absent.

```
FAIL src/leads-funnel/presales-consult-gate.util.spec.ts
  ✓ blocks when lead task incomplete
  ✓ blocks when no completed intake
  ✓ requires confirm on nurture decision
  ✓ allows go with strong BANT
  ✕ blocks go when Win gate on and answers empty
  ✓ allows go when Win gate on and required intel plus checklist 18
  ✓ allows go when Win gate off and answers empty

  Expected: false
  Received: true
    at … presales-consult-gate.util.spec.ts:71
Tests: 1 failed, 6 passed, 7 total
```

Failure is the missing Win overlay (flag ON + empty answers still Phase 1 `ok`), not a typo.

### GREEN

Implemented `intakeWinGateEnabled`, Phase 1 `base`, then Win block using brief messages / `WIN_THRESHOLDS.consult`. SQL SELECT updated.

```
PASS src/leads-funnel/presales-consult-gate.util.spec.ts
  ✓ blocks when lead task incomplete
  ✓ blocks when no completed intake
  ✓ requires confirm on nurture decision
  ✓ allows go with strong BANT
  ✓ blocks go when Win gate on and answers empty
  ✓ allows go when Win gate on and required intel plus checklist 18
  ✓ allows go when Win gate off and answers empty

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

Command:

```
cd services/ptt-crm-api && ./node_modules/.bin/jest src/leads-funnel/presales-consult-gate.util.spec.ts --no-coverage --forceExit
```

(`npx jest` hung resolving a different Jest; local 29.7.0 binary used.)

## Self-review

| Check | Result |
|-------|--------|
| Completeness | Flag, overlay after Phase 1, messages verbatim, SQL `answers_json`, tests as specified. |
| Quality | Phase 1 body unchanged; Win only when flag + `go`. |
| YAGNI | No `ai-intelligence.config` change; env read in util. No ops-web import. |
| Real tests | Call `validatePresalesConsultAdvance` with real helpers. |
| TDD | RED then GREEN recorded. |
| Pristine | Focused suite clean. Lints clean. |

## Concerns

None blocking. Ambient `PTT_INTAKE_WIN_GATE` is cleared in `beforeEach` and restored in `afterEach`. `parseWinIntel` already existed on the API (Task 2/3); not reimplemented.

## Review fix (Phase 1 block unchanged)

Win overlay must not replace an existing Phase 1 **block**. `validatePresalesConsultAdvance` now returns `base` immediately when `!base.ok`. Flag + `go` + thin Win only run when Phase 1 is **ok or warn**.

Added test: flag ON, `leadTaskDone` false, completed go session, empty answers → `ok===false`, message contains `task Lead`, not Win intel. `afterEach` restores `PTT_INTAKE_WIN_GATE`.

### Command

```
cd services/ptt-crm-api && npm test -- --testPathPattern=presales-consult-gate.util.spec --coverage=false
```

### Result

```
PASS src/leads-funnel/presales-consult-gate.util.spec.ts
  validatePresalesConsultAdvance
    ✓ blocks when lead task incomplete (2 ms)
    ✓ blocks when no completed intake
    ✓ requires confirm on nurture decision (1 ms)
    ✓ allows go with strong BANT
    ✓ keeps Phase 1 lead-task block when Win gate on and answers empty
    ✓ blocks go when Win gate on and answers empty (1 ms)
    ✓ allows go when Win gate on and required intel plus checklist 18
    ✓ allows go when Win gate off and answers empty

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        3.319 s
Ran all test suites matching /presales-consult-gate.util.spec/i.
```
