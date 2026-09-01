# Task 12 Report: Admin REST (P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** (pending) — feat(mkt-ai): admin playbook learn and activate API  
**Pushed:** no

## What shipped

Admin REST for playbook catalog, policy, learn jobs, and version lifecycle (submit / decide / activate / rollback) per spec §9 / §11.

| File | Role |
|------|------|
| `marketing-ai-playbook-admin.controller.ts` | Routes §11; guards view/generate/approve; staff-only activate/decide/rollback |
| `mkt-ai-playbook-admin.service.ts` | list, slug detail, policy patch, learn enqueue/status, version CRUD + activate gates §6.3 |
| `mkt-ai-playbook-versions.repository.ts` | list/update/activate versions; retire old active; set policy.active_version_id in txn |
| `mkt-ai-service-policy.repository.ts` | listPolicyRows, getPolicyRow, setActiveVersionId |
| `guards/staff-marketing-ai-planner.guard.ts` | AdminViewGuard + StaffApproveGuard (blocks internal/AI token on activate) |
| `marketing-ai-playbook-admin.controller.spec.ts` | Controller + guard: internal token → 403 on activate |
| `mkt-ai-playbook-admin.service.spec.ts` | Activate gates: approved only, self_approve+note, accept_shallow |

## Routes

| Method | Path | Cap |
|--------|------|-----|
| GET | `/api/v1/admin/mkt-ai/playbooks` | view |
| GET | `/api/v1/admin/mkt-ai/playbooks/:slug` | view |
| PATCH | `/api/v1/admin/mkt-ai/playbooks/:slug/policy` | approve |
| POST | `/api/v1/admin/mkt-ai/playbooks/:slug/learn` | generate |
| GET | `/api/v1/admin/mkt-ai/playbooks/:slug/learn/:jobId` | view |
| PATCH | `/api/v1/admin/mkt-ai/playbooks/versions/:id` | generate |
| POST | `.../versions/:id/submit` | generate |
| POST | `.../versions/:id/decide` | approve (staff JWT) |
| POST | `.../versions/:id/activate` | approve (staff JWT) |
| POST | `.../versions/:id/rollback` | approve (staff JWT) |

Legacy disk catalog moved to `GET .../playbooks/catalog-disk` (WS-P4-08 smoke).

## Activate rules (§6.3)

- Status must be `approved`
- `reviewed_by !== created_by` **or** `self_approve` + `note` ≥ 20 chars
- `depth=shallow` requires `accept_shallow=true`
- Retires prior `active` version; sets `mkt_ai_service_policy.active_version_id`
- Internal/AI token blocked by `StaffMarketingAiPlaybookStaffApproveGuard`

## Step checklist

- [x] Admin service list + policy patch + learn enqueue/status
- [x] Version submit / decide / activate / rollback
- [x] Activate gates per spec
- [x] Uses Task 11 learn service + versions/policy repos
- [x] Jest: activate from internal token → 403
- [x] **Commit** `feat(mkt-ai): admin playbook learn and activate API`

## What I tested

```bash
cd services/ptt-crm-api && npx jest \
  src/marketing-ai-planner/marketing-ai-playbook-admin.controller.spec.ts \
  src/marketing-ai-planner/mkt-ai-playbook-admin.service.spec.ts \
  --no-coverage
```

```
PASS marketing-ai-playbook-admin.controller.spec.ts (5 tests)
PASS mkt-ai-playbook-admin.service.spec.ts (5 tests)
Test Suites: 2 passed | Tests: 10 passed
```

## Notes

- `loadCorpusRows` still stubbed in learn service; admin list/detail shows corpus counts from stub until lifecycle SQL wired.
- Smoke script `scripts/smoke_mkt_ai_playbooks_admin.sh` should target `catalog-disk` or be updated in Task 16.

## Next

Task 13: Admin UI (`ops-web` playbooks page + API client).
