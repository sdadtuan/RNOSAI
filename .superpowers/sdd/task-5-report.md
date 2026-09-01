# Task 5 Report: Playbook `_common` + resolve chain (P1)

**Status:** DONE  
**Branch:** `feat/intake-win-score-phase2` (current)  
**Commit:** `81d1604d` — feat(mkt-ai): _common playbook fallback for any pilot slug  
**Pushed:** no

## What shipped

Generic `_common` playbook as fallback for any pilot service slug without an industry-specific playbook. Industry matching via `matchPlaybookForServiceSlug` is unchanged; resolution chain falls back to `_common` through `resolvePlaybookForSlug`.

| File | Role |
|------|------|
| `services/ptt-crm-api/src/marketing-ai-planner/playbooks/_common.json` | New fallback playbook: `slug=_common`, empty `service_slugs`, generic brief defaults, 3 strategy hints, 2 KPI templates, quality gate 70/2, governance (human-in-the-loop + no auto-mail). |
| `marketing-ai-playbook.util.ts` | Added `_common` to `MKT_AI_PLAYBOOK_SLUGS`; `resolvePlaybookForSlug`; schema allows empty `service_slugs` for `_common`; `resolveActivePlaybookSlug` uses resolve chain. |
| `marketing-ai-playbook.service.ts` | `resolvePlaybook` / `listForLifecycle` use `resolvePlaybookForSlug`; `_common` always included in lifecycle list. |
| `marketing-ai-playbook.util.spec.ts` | Fallback test for unknown slug → `_common`. |
| `marketing-ai-playbook.service.spec.ts` | Tests `_common` always listed + active for unknown pilot slug. |
| `scripts/verify_mkt_ai_playbooks.sh` | Schema gate allows empty `service_slugs` for `_common`. |

## Step checklist

- [x] **Step 1: Failing test** — `resolvePlaybookForSlug('quang-cao-facebook')` → `_common`; `matchPlaybookForServiceSlug` stays null for unknown industry slugs.
- [x] **Step 2: `_common.json`** — Created per schema; no `*` wildcard in match.
- [x] **Step 3: Verify** — `verify_mkt_ai_playbooks.sh` + jest playbook specs pass.
- [x] **Step 4: Commit** — see commit hash after push.

## Verification

```bash
./scripts/verify_mkt_ai_playbooks.sh
```

```
found 4 playbook JSON file(s)
OK  _common.json
OK  bds-lead-gen.json
OK  meta-lead-gen.json
OK  seo-retainer.json
OK  verify_mkt_ai_playbooks — 4 files validated
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
| `_common` not matched by industry | `service_slugs: []`; match unchanged |
| Fallback chain | industry match → catalog `_common` → `readPlaybookFile('_common')` |
| Lifecycle list | `_common` always included even when pilot filter excludes industry playbooks |
| Governance | human-in-the-loop + no auto-mail in hints and notes |
| Schema | util + verify script both allow empty `service_slugs` for `_common` only |

## Concerns

- `resolveActivePlaybookSlug` now always returns a slug (at least `_common`) for non-empty service slugs; callers that treated `null` as "no playbook" may need follow-up if any exist outside tested paths.
