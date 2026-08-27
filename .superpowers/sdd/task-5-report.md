# Task 5 Report: Sales PostgreSQL Cutover

**Status:** Complete
**Branch:** `feat/wave1-sqlite-to-pg`

## Summary

- Added `SalesPgRepository` and ported every public method from `SalesSqliteRepository`.
- Rewired `SalesService` and `SalesModule` to PostgreSQL only.
- Preserved the existing Sales API JSON shapes and validation behavior.
- Added idempotent PostgreSQL DDL for plans, targets, partners, trainings, market research, and transactions.
- Continued to aggregate funnel, customer, staff, and case data from their existing PostgreSQL tables.
- Left the legacy SQLite repository in the tree but disconnected from runtime wiring.

## Scope decision

Sales is not aggregation-only. The existing repository owns six Sales-specific data sets in addition to reading `crm_cases`, `crm_customers`, and `crm_staff`, so the PostgreSQL repository retains those tables rather than reducing Sales to leads/customers/orders.

## TDD

RED:

```text
FAIL src/sales/sales-pg.repository.spec.ts
TS2307: Cannot find module './sales-pg.repository'
```

GREEN:

```text
PASS src/sales/sales-pg.repository.spec.ts
3 tests passed
```

Coverage includes PostgreSQL-only wiring, Sales schema bootstrap, API row mapping, and parameterized partner search.

## Verification

```text
npm --prefix services/ptt-crm-api test -- src/sales --no-coverage
1 suite passed, 3 tests passed

npm --prefix services/ptt-crm-api run build
exit 0

git diff --check -- services/ptt-crm-api/src/sales
exit 0
```

The requested command is equivalent to `cd services/ptt-crm-api && npx jest src/sales --no-coverage`; the package-prefixed form was used from the repository root.

## Concerns

- No live PostgreSQL smoke was run; repository tests mock the PostgreSQL pool.
- Existing Sales-specific SQLite records require the separate migration/backfill process before production cutover.
- The npm command emits the existing unsupported `devdir` configuration warning.

## Commit

`Serve CRM sales views from PostgreSQL only.`
