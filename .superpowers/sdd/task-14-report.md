# Task 14 Report: Saved views + bulk owner transfer

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `4c9254be` — feat(am): add saved views and bulk owner transfer  
**Date:** 2026-09-05

## Summary

Added persisted saved views (`GET/POST /api/crm/am/views`) and bulk owner transfer (`POST /api/crm/am/accounts/transfer`, cap `assign`). Accounts list now has row checkboxes, a bulk bar, **Đổi Owner** modal (reason required, keep secondary, optional task move), and Lưu view. No Account 360 (Task 15).

## Backend

### Views — `am-views.service.ts`

- `GET /views` (`view`): own views + `shared=true`
- `POST /views` (`view`): `{ name, shared?, page?, query_json }`
- Max **10** views / user → 400 `view_limit`
- `shared=true` needs `manage` or team-lead (`assign` + `view_all`) → else 403

### Transfer — `AmAccountsService.transfer`

- Body: `{ agency_client_ids[], to_staff_id, reason, keep_secondary?, backup_staff_id?, move_open_tasks? }`
- Missing/blank reason → 400 `reason_required`
- View-only actor → 403 `missing_cap` (service + `StaffAmGuard` `@RequireAmAction('assign')`)
- One owner: `account_owner_staff_id = to_staff_id`; `backup_staff_id` only when `keep_secondary` (explicit or previous owner)
- Also `UPDATE clients SET owner_am_id = to_staff_id::text`
- `move_open_tasks=true` updates open `crm_am_tasks` assignee; omitted/false leaves tasks
- Audit `account.transfer` with previous owners + flags

CLASS/JWT token injection is unchanged: `StaffOrInternalKeyGuard` + `amFetch` Bearer from `useAmPage().token`.

## Frontend

- Checkboxes + select-page; bulk bar: `Đã chọn N` · **Đổi Owner** (assign/manage) · Bỏ chọn
- Modal **Đổi Owner**: owner select + staff id, keep secondary, task radio, reason *
- Saved-view chips from API + Lưu view (shared checkbox only if can share)

## TDD Evidence

**RED** (before implementation):

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-transfer.spec.ts \
  src/am/am-views.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
```

- `am-accounts-transfer.spec.ts` failed TS2339: `Property 'transfer' does not exist` (feature missing)
- `am-views.service.spec.ts` failed TS2307: `Cannot find module './am-views.service'`
- Guard assign-403 already passed (existing `StaffAmGuard`)

**GREEN** (after implementation):

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-transfer.spec.ts \
  src/am/am-views.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts --no-coverage
# 5 suites, 22 passed
```

Required cases: missing reason 400; view user 403; task move only when `move_open_tasks=true`. Also: audit `account.transfer`; shared view 403; 11th view 400.

Frontend vitest (not required): `am-accounts-views.util.spec.ts` — 8 passed.

## Files changed

- `services/ptt-crm-api/src/am/am-views.service.ts` (new)
- `services/ptt-crm-api/src/am/am-views.service.spec.ts` (new)
- `services/ptt-crm-api/src/am/am-accounts-transfer.spec.ts` (new)
- `services/ptt-crm-api/src/am/am-accounts.service.ts`
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-accounts-views.util.ts`
- `services/ops-web/src/lib/crm/am-accounts-views.util.spec.ts`
- `services/ops-web/src/components/crm/am/AmAccountsList.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Self-review

- Spec coverage complete; no 360.
- Bulk Tag / Tạo Task / Export left out (not in Task 14).
- Transfer SQL uses `$N` placeholders; sort/filter unchanged.

## Concerns

1. **Roster id ≠ `crm_staff.id`** — modal options use `staff_users.id`; SoR owner is `crm_staff.id`. Numeric input is provided as fallback. A join-by-email resolve is not in this task.
2. List UI not browser-verified (staff login required).
3. No PATCH/DELETE view (GET/POST only, as specified).

## Review fixes (2026-09-05)

Addressed Task 14 Critical + Important review findings.

### CRITICAL — transfer applies `amScopeSql`

- Actor resolved like list: `manage` / `view_all` → `all`; `assign` with team membership → `team`; else `me`.
- In-scope rows loaded with `amScopeSql` before writes. Any requested id outside scope → 403 `out_of_scope`.
- UPDATE `crm_am_account_ext` also AND-s the same scope fragment. UPDATE `clients` only runs after a scoped ext update (`transferred > 0`).
- Test: `assign+me cannot transfer another owner UUID` — 403 and no `UPDATE clients`.

### IMPORTANT — `to_staff_id` is `crm_staff.id`

- Reject ids not in `crm_staff` (400 `to_staff_id_invalid`).
- Roster still uses `/api/v1/staff/auth/roster` (`staff_users.id`). Transfer remaps via email join (`staff_users` → `crm_staff`) when the numeric id is not a `crm_staff.id`. Collision: an id that exists on `crm_staff` wins (SoR). Modal copy + placeholder say `crm_staff ID`.
- Safe AM staff list (future): `SELECT id, name, email FROM crm_staff WHERE active` for the owner picker so the UI never sends `staff_users.id`.

### IMPORTANT — manage OR assign

- Service already accepted `manage` or `assign`.
- `StaffAmGuard`: required `assign` on `crm_am` also allows `manage`. Manage scope is `all`.
- Đổi Owner stays visible when `canAssignAmAccounts` (assign or manage).

### Transaction + rowCount

- Writes wrapped in `withTransaction` (BEGIN/COMMIT/ROLLBACK on one client).
- `transferred` is the ext UPDATE `rowCount`, not `ids.length`.

### Re-test

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-transfer.spec.ts \
  src/am/am-views.service.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# 3 suites, 21 passed
```
