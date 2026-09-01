# Task 4 Report: Policy repository + inject into allow (P0)

## Status: DONE

**Branch:** `feat/mkt-ai-playbook-learn`

## What shipped

| File | Role |
|------|------|
| `mkt-ai-service-policy.repository.ts` | Lazy `Pool` from `config.databaseUrl`; `getPolicy(slug)`, `upsertPolicy(slug, patch, actor)` |
| `mkt-ai-planner-allow.service.ts` | `ensure(slug)` — loads DB policy, runs `assertPlannerAllowed` + `throwPlannerAllowResult` |
| `marketing-ai-planner.module.ts` | Provides + exports `MktAiServicePolicyRepository`, `MktAiPlannerAllowService` |
| `marketing-ai-planner.service.ts` | `assertEnabled` / `assertEnabledPublic` async → `await this.allow.ensure(slug)` |
| `marketing-ai-dashboard.service.ts` | Uses allow service |
| `marketing-ai-optimize.service.ts` | Uses allow service |
| `marketing-ai-kpi-closed-loop.service.ts` | Uses allow service |
| `marketing-ai-weekly-memo.service.ts` | Uses allow service |
| `portal-mkt-ai-summary.service.ts` | `assertPlannerSlug` async via allow |
| `leads-funnel.service.ts` | `assertPresalesMktAiEnabled` async via `MktAiPlannerAllowService` |
| `leads-funnel.module.ts` | `forwardRef(() => MarketingAiPlannerModule)` |
| `marketing-ai-multi-agent.service.ts` | `await assertEnabledPublic` |

## Tests

```
cd services/ptt-crm-api && npx jest \
  --testPathPattern='mkt-ai-service-policy|mkt-ai-planner-allow|marketing-ai-planner|leads-funnel' \
  --no-coverage
```

**Result:** 60 suites, 230 tests passed.

New specs:
- `mkt-ai-service-policy.repository.spec.ts` — mock query for get/upsert
- `mkt-ai-planner-allow.service.spec.ts` — pilot ok; `off` → Forbidden `mkt_ai_service_not_enabled`

Updated specs: `marketing-ai-planner.service.spec.ts`, `marketing-ai-dashboard.service.spec.ts`, `marketing-ai-optimize.service.spec.ts` — inject `allow.ensure` mock.

## Commit

`feat(mkt-ai): load service policy in planner allow`

Not pushed.

## P0 behavior

- Slug with DB policy `rollout=off` → 403 `mkt_ai_service_not_enabled` (VI message + `admin_path`).
- Seed `pilot` + empty env slugs → allowed (policy path).
- Env AND still applies: non-empty `PTT_MKT_AI_PLANNER_SLUGS` without slug → blocked even if DB says pilot.

## Concerns

1. **DB required at runtime** — `getPolicy` queries Postgres; if table missing (Task 3 DDL not applied), planner endpoints will 500. Apply DDL + seed on VPS before deploy.
2. **No in-memory fallback** — unlike `MarketingAiPlannerRepository`, policy repo always hits PG (acceptable for P0 admin policy).
3. **LeadsFunnelModule circular import** — uses `forwardRef(() => MarketingAiPlannerModule)`; monitor Nest bootstrap if new cycles appear.
4. **`MarketingAiOrchestratorService` still local provider** in leads-funnel module (pre-existing); not exported from planner module.
