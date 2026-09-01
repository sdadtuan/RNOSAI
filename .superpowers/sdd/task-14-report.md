# Task 14 Report: Planner resolve from active_version_id (P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** `63f58d9d` — feat(mkt-ai): planner uses active playbook version  
**Pushed:** no

## What shipped

Planner TMMT generation now resolves playbooks from DB versions per spec §5.4 before falling back to disk JSON.

| File | Role |
|------|------|
| `marketing-ai-playbook.service.ts` | Async `resolvePlaybook` / `getPlaybook` — brief slug → policy `active_version_id` → `_common` active → disk |
| `marketing-ai-playbook.util.ts` | `parsePlaybookDocument()` — normalize version `document_json` with quality_gate defaults |
| `marketing-ai-playbook.module.ts` | Inject `MktAiServicePolicyRepository` + `MktAiPlaybookVersionsRepository` |
| `marketing-ai-planner.service.ts` | Await async resolve in strategy/campaign jobs + lifecycle context |
| `portal-mkt-ai-summary.service.ts` | Await `buildContextFromDraft` for portal summary |
| `marketing-ai-playbook.service.spec.ts` | Jest: policy active custom beats disk `meta-lead-gen` |

## Resolve order (§5.4)

1. `brief._playbook_slug` when that slug has an `active` or `approved` version in `mkt_ai_playbook_versions`
2. Policy `active_version_id` document for `service_slug`
3. `_common` active version from DB
4. Disk catalog (`resolvePlaybookForSlug`)

## Step checklist

- [x] Inject `mkt-ai-playbook-versions.repository` + policy repo into playbook service
- [x] `resolvePlaybook` / `getPlaybook` follow §5.4 order
- [x] Planner strategy/campaign jobs await DB resolve for prompt hints
- [x] Jest: policy active custom beats disk meta-lead-gen
- [x] **Commit** `feat(mkt-ai): planner uses active playbook version`

## What I tested

```bash
cd services/ptt-crm-api && npx jest src/marketing-ai-planner/marketing-ai-playbook.service.spec.ts --no-coverage
cd services/ptt-crm-api && npx jest src/marketing-ai-planner/ --no-coverage
```

```
PASS marketing-ai-playbook.service.spec.ts (7 tests)
  ✓ resolvePlaybook uses policy active version over disk meta-lead-gen

Test Suites: 39 passed | Tests: 171 passed (marketing-ai-planner/)
```

## Notes

- `buildContextFromDraft` and `checkLaunchQaQualityGate` are now async (callers updated).
- Disk fallback preserved for P1 migration window when DB versions not seeded.
- `AiPlaybookSelector` already lists from lifecycle API including `_common` (Task 5/13); no UI change required this task.

## Next

Task 15: P3 depth — tier-3 artifacts + week hints guard.
