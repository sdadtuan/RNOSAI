# Task 18 Report — CRM API config cleanup

## Status

Completed Task 18 only.

## Changes

- Removed `sqlitePath`, `resolveSqlitePath()`, `sqliteAvailable()`, `LeadsReadSource`, `leadsReadSource`, and all CRM PostgreSQL cutover booleans from `AppConfigService`.
- Hardcoded the health response to `leads_read_source: "pg"`, `sqlite: false`, and `postgres: true`.
- Removed obsolete PostgreSQL feature-flag branches and SQLite fallbacks from lead SLA care, lead status gates, and closed-loop services.
- Replaced SEO admin's remaining SQLite customer/task lookups with PostgreSQL queries.
- Updated stale test fixtures that still supplied removed SQLite/CRM flag config.

## Verification

- `npm run build`: passed.
- Focused Jest run: 4 suites passed, 18 tests passed.
- Full `npx jest --no-coverage`: 471 suites passed, 5 suites failed; 1,979 tests passed and 2 failed. The five failures are pre-existing/out of Task 18 scope:
  - stale constructor arguments in `marketing-ai-planner.service.spec.ts`
  - missing `LmpSciAnalyticsService` provider in `manager-coach.service.spec.ts`
  - stale constructor arguments in `b2b-sla-tick.service.spec.ts`
  - deleted SQLite repository imports in `billing-schema.spec.ts`
  - stale constructor arguments in `agent.registry.spec.ts`

## Concerns

- The full Jest suite is not green because of the unrelated failures listed above.
- SEO admin now requires the PostgreSQL `crm_customers`, `crm_service_lifecycle`, and `crm_svc_tasks` tables for customer labels and service-task data.
