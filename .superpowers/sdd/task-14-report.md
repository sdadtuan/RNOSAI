# Task 14 Report — AI Intelligence context repos PG-only

## Status

Implemented Task 14 only. AI Intelligence context reads now use PostgreSQL through `Pool` or the existing `CrmLeadsPgRepository`; the eight scoped files contain no `CrmLeadsSqliteRepository`, `DatabaseSync`, `node:sqlite`, or `sqlitePath` references.

PostgreSQL's asynchronous query API required focused `await` updates in the AI Intelligence services that call the migrated repositories.

## Verification

- `npm run build`: PASS
- Task 14 affected tests: PASS — 8 suites, 33 tests
- Coach digest, deal score, forecast, and controller smoke coverage: PASS — 4 suites, 11 tests
- PostgreSQL-only regression: PASS — 8 scoped files checked
- Full `jest src/ai-intelligence`: 52 suites passed, 4 skipped, 2 unrelated suites failed:
  - `manager-coach.service.spec.ts` does not provide the existing `LmpSciAnalyticsService` constructor dependency.
  - `orchestrator/agent.registry.spec.ts` constructs `AgentRegistry` with five arguments while the existing constructor requires six (`BudgetRecommendService`).

The two full-suite failures are outside Task 14 and were not modified.

## Scope guard

Task 15 was not started.
