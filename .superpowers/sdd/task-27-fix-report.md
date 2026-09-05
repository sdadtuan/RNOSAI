# Task 27-FIX Report — Open risks exclude churned

## Problem

`countOpenRisks` counted open risks for all accounts in scope, including churned clients. Band tiles and the sparkline already exclude `e.am_status = 'churned'`, so the open-risks tile could over-count relative to the rest of the health center.

## TDD

1. Added `AmHealthRepository › countOpenRisks excludes churned accounts from COUNT SQL` in `am-health.service.spec.ts`.
2. Confirmed failure: COUNT SQL lacked `am_status` / `churned`.
3. Added `AND e.am_status <> 'churned'` to `countOpenRisks` (same predicate as `loadSparkline`).
4. All 8 tests in `am-health.service.spec.ts` pass.

## Change

| File | Change |
|------|--------|
| `services/ptt-crm-api/src/am/am-health.service.spec.ts` | Repository test asserting COUNT SQL excludes churned |
| `services/ptt-crm-api/src/am/am-health.service.ts` | `countOpenRisks`: `AND e.am_status <> 'churned'` |

## Verification

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=am-health.service.spec
# 8 passed
```

## Commit

`fix(am): exclude churned from open-risks tile`

DONE
