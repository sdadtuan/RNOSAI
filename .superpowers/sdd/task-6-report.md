# Task 6 Report: AiPlaybookSelector show `_common` (P1)

**Status:** DONE  
**Branch:** `feat/intake-win-score-phase2` (current)  
**Commit:** (pending) — feat(mkt-ai): show _common in planner playbook picker  
**Pushed:** no

## What shipped

Planner playbook dropdown now always surfaces `_common` first and defaults to it for pilot slugs without an industry playbook.

| File | Role |
|------|------|
| `services/ops-web/src/lib/mkt-ai-playbook-selector.util.ts` | `orderPlaybooksForSelector` — `_common` first, then service-slug match, then remaining shipped playbooks (vi sort). `defaultPlaybookSlug` — active → slug match → `_common` → first. |
| `services/ops-web/src/lib/mkt-ai-playbook-selector.util.spec.ts` | Vitest for ordering + default slug for unknown pilot slug. |
| `services/ops-web/src/components/mkt-ai/AiPlaybookSelector.tsx` | Uses ordered list + `_common` default; dropdown renders `displayPlaybooks`. |
| `services/ptt-crm-api/.../marketing-ai-playbook.service.ts` | **Verified (Task 5)** — `listForLifecycle` already keeps `_common` when `pilotSlugs` filter would drop it. No change needed. |

## Step checklist

- [x] **Step 1:** Dropdown shows `_common` + matching slug playbook + shipped industry playbooks from API (pilot-filtered).
- [x] **Step 2:** Vitest for selector util; backend playbook specs re-run (20 passed).
- [x] **Step 3:** Commit `feat(mkt-ai): show _common in planner playbook picker`

## Verification

```bash
cd services/ops-web && npx vitest run src/lib/mkt-ai-playbook-selector.util.spec.ts
```

```
✓ src/lib/mkt-ai-playbook-selector.util.spec.ts (4 tests)
```

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=marketing-ai-playbook --silent
```

```
PASS marketing-ai-playbook.service.spec.ts
PASS marketing-ai-playbook.util.spec.ts
Tests: 20 passed, 20 total
```

## Self-review

| Check | Result |
|-------|--------|
| `_common` always first in dropdown | `orderPlaybooksForSelector` pushes `_common` before other rows |
| Unknown pilot slug defaults to `_common` | `defaultPlaybookSlug` + backend `active_slug` / resolve chain |
| Backend pilot filter | `_common` bypasses `pilotSlugs` filter in `listForLifecycle` |
| No duplicate options | `seen` set in ordering helper |

## Concerns

- Shipped playbooks beyond the lifecycle service slug still depend on `PTT_MKT_AI_PLANNER_SLUGS` pilot config (by design from Task 5). Task 14 will add DB `active_version_id` resolution.
