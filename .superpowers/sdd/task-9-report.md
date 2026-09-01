# Task 9 Report: Corpus filter C1–C5 + W1 + seed exclude (P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** (pending) — feat(mkt-ai): corpus gates 5/3/deep for playbook learn  
**Pushed:** no

## What shipped

Pure util `classifyCorpus` gates playbook learn corpus: C1–C5 candidate filters (slug match, applied, quality ≥70, human-edited, seed exclude), W1 winners (`closedLoopWin`), depth `shallow` vs `deep` (≥3 winners with tier-3 artifacts), `canLearn` at 5 candidates, `remaining` countdown.

| File | Role |
|------|------|
| `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.ts` | `CorpusLifecycleInput`, `classifyCorpus` |
| `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.spec.ts` | Jest: 4 HĐ, 5/2 shallow, 5/3/deep, seed exclude, filter edge cases |

## Step checklist

- [x] TDD: failing tests first (module not found)
- [x] `classifyCorpus` verbatim from plan Task 9
- [x] Tests: 4 HĐ → `canLearn=false`; 5 candidates 2 winners → `shallow` + `canLearn`; 5/3 winners + 3 artifacts → `deep`; seed id ≥900000901 + `isUatSeed` excluded
- [x] Jest spec PASS (5 tests)
- [x] **Commit** `feat(mkt-ai): corpus gates 5/3/deep for playbook learn`

## Gate logic summary

| Gate | Rule |
|------|------|
| C1 | `serviceSlug === slug` |
| C2 | `applied === true` |
| C3 | `qualityScore >= 70` |
| C4 | `humanEditedAfterGenerate === true` |
| C5 | `!isUatSeed` and (`sqliteLeadId == null` or `< 900000901`) |
| W1 | `closedLoopWin === true` (among candidates) |
| Learn | `candidates.length >= 5` → `canLearn` |
| Deep | `winners.length >= 3` **and** ≥3 winners with `hasTier3Artifact` |
| Remaining | `max(0, 5 - candidates.length)` |

## What I tested

```bash
cd services/ptt-crm-api && npx jest src/marketing-ai-planner/mkt-ai-playbook-corpus.util.spec.ts --no-coverage
```

```
PASS src/marketing-ai-planner/mkt-ai-playbook-corpus.util.spec.ts
  classifyCorpus
    ✓ 4 HĐ → canLearn=false, remaining=1
    ✓ 5 candidates + 2 winners → shallow + canLearn
    ✓ 5 candidates + 3 winners + 3 tier-3 artifacts → deep
    ✓ excludes UAT seed and sqliteLeadId >= 900000901
    ✓ filters wrong slug, not applied, low quality, not human-edited

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## Next

Task 10: `rejectLearnedPlaybook` PII + schema validator. Task 11: learn service calls `classifyCorpus` for `playbook_learn_need_more` / depth.
