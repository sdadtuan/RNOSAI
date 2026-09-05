# Task 28-FIX Report: Override audit + risk_id bind

**Status:** DONE  
**Branch:** `feat/am-os`  
**Date:** 2026-09-05

## Summary

Closed two gaps from Task 28 review: care-plan Critical override now writes audit `plan.care_override`, and `createRecovery` validates `risk_id` belongs to the same tenant + client before insert.

## Changes

### Care-plan override (BR-020)

- `manage + override_reason` on Critical without open recovery → care plan created (existing gate preserved).
- `manage` without reason → **409 `recovery_required`**.
- `override_reason` without manage → **409 `recovery_required`**.
- Successful override → audit `plan.care_override` with `{ agency_client_id, override_reason }` on entity type `plan`.

`AmPlansService` now optionally injects `AmAuditRepository` and detects override via `isRecoveryRequired` before `assertCriticalRecovery`.

### Recovery risk bind

- `createRecovery` with `risk_id` set → lookup `crm_am_risks` for `tenant_id` + `agency_client_id` + `id`.
- Missing risk → **404 `risk_not_found`** (no INSERT).
- Valid risk → insert proceeds as before.

## TDD evidence

**RED** (before implementation):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-plans.service.spec.ts src/am/am-risks.service.spec.ts --no-coverage
# am-plans: TS2554 Expected 2-4 arguments, but got 5 (audit ctor missing)
# am-risks: createRecovery resolved instead of 404 risk_not_found
```

**GREEN** (after implementation):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-plans.service.spec.ts src/am/am-risks.service.spec.ts --no-coverage
# 2 suites, 14 passed

$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-accounts-360.spec.ts src/am/am-health.service.spec.ts --no-coverage
# 2 suites, 21 passed
```

## Files

- `services/ptt-crm-api/src/am/am-plans.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-risks.service.ts` (+ spec)

## Commit

`fix(am): audit Critical care override and bind recovery risk`

DONE
