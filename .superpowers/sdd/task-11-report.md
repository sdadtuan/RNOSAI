# Task 11 Report: Learn service enqueue + run (P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** (pending) — feat(mkt-ai): playbook learn job writes draft only  
**Pushed:** no

## What shipped

Playbook learn job pipeline: `enqueueLearn` gates corpus/cooldown/concurrency, runs async job via orchestrator JSON, validates with `rejectLearnedPlaybook`, writes version `draft` or `rejected_auto` — never `active`.

| File | Role |
|------|------|
| `mkt-ai-playbook-versions.repository.ts` | CRUD learn jobs + versions (insert draft/rejected_auto, cooldown 7d, in-progress check) |
| `mkt-ai-playbook-learn.service.ts` | `enqueueLearn`, `runJob`, stub `loadCorpusRows`, `ai_agent_runs` audit |
| `mkt-ai-playbook-learn.service.spec.ts` | Jest: need_more, cooldown, in_progress, disabled 404, draft, rejected_auto |
| `marketing-ai-orchestrator.service.ts` | `generateLearnedPlaybook` JSON completion |
| `app-config.service.ts` | `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED` → `mktAiPlaybookLearnEnabled` |
| `marketing-ai-planner.module.ts` | Wire repo + learn service |

## Step checklist

- [x] `enqueueLearn(slug, actor, excludeLifecycleIds)` → `{ job_id, status }`
- [x] 409 `playbook_learn_cooldown` if succeeded < 7 days
- [x] 409 `playbook_learn_in_progress` if queued/running
- [x] 409 `playbook_learn_need_more` + `remaining` when `!canLearn` (via `classifyCorpus` + stub corpus loader)
- [x] Job calls `MarketingAiOrchestratorService.generateLearnedPlaybook` → `rejectLearnedPlaybook` → `rejected_auto` or `draft`
- [x] `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=0` → 404
- [x] Audit `ai_agent_runs` `use_case=mkt_ai_playbook_learn` when table ready
- [x] Unit tests mock orchestrator + corpus (8 tests PASS)
- [x] **Commit** `feat(mkt-ai): playbook learn job writes draft only`

## What I tested

```bash
cd services/ptt-crm-api && npx jest src/marketing-ai-planner/mkt-ai-playbook-learn.service.spec.ts --no-coverage
```

```
PASS src/marketing-ai-planner/mkt-ai-playbook-learn.service.spec.ts
  MktAiPlaybookLearnService
    ✓ 404 when PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=0
    ✓ 409 playbook_learn_need_more when only 4 candidates
    ✓ 409 playbook_learn_cooldown when succeeded within 7 days
    ✓ 409 playbook_learn_in_progress when queued/running exists
    ✓ enqueueLearn returns job_id and triggers run
    ✓ runJob writes draft when AI output passes validation
    ✓ runJob writes rejected_auto when brand_name leaks
    ✓ never inserts active status from learn job

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

## Notes

- `loadCorpusRows` returns `[]` until Task 12 admin REST wires real lifecycle SQL; tests mock via `jest.spyOn`.
- `insertVersion` type excludes `active` — learn path cannot promote to active.
- Env: `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=1` required alongside planner/playbooks flags.

## Next

Task 12: Admin REST (`POST .../learn`, job status, version decide/activate) in `marketing-ai-playbook-admin.controller.ts`.
