# Task 13 Report: Accounts list API + UI-AM-02

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `0921985e` — feat(am): add scoped account list with saved-view chips  
**Date:** 2026-09-05

## Summary

Added scoped `GET /api/crm/am/accounts` and replaced the Wave 2 clients placeholder with UI-AM-02. Default hides churned. `view` is forced through `amScopeSql` (`me`) so other owners cannot leak. `sort=ends_on` is `ORDER BY` on the server. Saved-view chips are URL query presets, not hardcoded rows.

## Backend

- `AmAccountsService.list` — filters `q`, `owner`, `team`, `band`, `lifecycle`, `industry`, `parent`, `ends_within`; page size default 50.
- Scope via `resolveAmScope` + `amScopeSql`. Unassigned rows/chip only for `assign` / `view_all` / `manage`.
- SQL uses `$N` placeholders only (no interpolated user values). Sort keys are allowlisted.
- Degrades if `crm_contracts` or `staff_teams` is missing.

## Frontend

- `AmAccountsList` on `/crm/account-management/clients`
- Chips: Tất cả · Của tôi · Cần chú ý · Gia hạn 90 ngày · Chưa gán owner · Parent group
- URL is the filter source. Sticky header. Empty cells → `—`. Parent rows show `child_count`.
- Density from AmShell. No bulk transfer (Task 14). No 360 (Task 15).

## Tests

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts --no-coverage
# 6 passed (create + list: churned hidden, view cannot see other owner, sort ends_on)

cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/crm/am-accounts-views.util.spec.ts
# 6 passed
```

## Concerns

1. `delegated_until` is always null — no column on `crm_am_account_ext`.
2. Search `q` is name/code only (`clients` has no MST/phone/email).
3. List UI not browser-verified (staff login required).
4. Client 360 route remains a Wave 2 placeholder.

## Commit

`feat(am): add scoped account list with saved-view chips`
