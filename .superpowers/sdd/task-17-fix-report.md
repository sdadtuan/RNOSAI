# Task 17-FIX Report: Handover accept atomicity

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `cb0a182f` — fix(am): make handover accept transactional  
**Date:** 2026-09-05

## Summary

`POST /api/crm/am/handovers/:id/accept` now wraps handover `accepted` → ext `onboarding` → case INSERT in `withTransaction` (BEGIN/COMMIT/ROLLBACK on one client, same pattern as `AmAccountsService.transfer`). The handover UPDATE requires `status IN ('pending_am','needs_info')`. `rowCount === 0` → 409 `already_processed` and no case/audit writes. `400 checklist_required` still runs before the transaction.

Did not add GET uniqueness or Sales-send validation.

## Backend

- `AmOnboardingRepository.withTransaction` — one pool client, BEGIN / COMMIT / ROLLBACK.
- `AmOnboardingService.inTx` — uses `db.withTransaction` when present, else `db.query`.
- Accept writes inside `inTx`:
  1. `UPDATE crm_am_handovers … AND status IN ('pending_am','needs_info')`
  2. if `rowCount === 0` → 409 `already_processed` (rollback; no further writes)
  3. `UPDATE crm_am_account_ext` `am_status='onboarding'`
  4. published template SELECT + `INSERT crm_am_onboarding_cases`
- Audit `handover.accept` after successful COMMIT (same as transfer).
- Checklist 400 remains before `requireActionable` / `inTx`.

## TDD evidence

**RED** (before production change):

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage
# accept writes audit: Expected withTransaction toHaveBeenCalled, received 0
# concurrent rowCount 0: promise resolved instead of 409 already_processed
# 2 failed, 2 passed
```

**GREEN:**

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage
# 1 suite, 4 passed
```

Required: concurrent/already-accepted UPDATE `rowCount 0` → 409 `already_processed`, no `INSERT` case, no audit. Also: checklist 400 does not open a transaction; happy-path UPDATE includes `status IN ('pending_am','needs_info')`.

## Files

- `services/ptt-crm-api/src/am/am-onboarding.service.ts`
- `services/ptt-crm-api/src/am/am-onboarding.service.spec.ts`

Commit contains only those two files. `.superpowers/` and `node_modules` not staged.

## Concerns

1. **Audit is still after COMMIT** — `AmAuditRepository` uses its own pool. A crash between commit and `audit.insert` can leave `accepted` + case without `handover.accept`. Same pattern as `AmAccountsService.transfer`.
2. **Race test is mocked** — Jest returns `rowCount: 0`; not two real concurrent clients.
3. **Pre-check still uses `handover_not_pending`** — already-accepted on first load is 409 `handover_not_pending`. `already_processed` is only the UPDATE race.
4. **UI not updated** — no dedicated toast for `already_processed` (out of brief).
