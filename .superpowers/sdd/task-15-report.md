# Task 15 Report: Account 360 Overview (UI-AM-03)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `792da9c6` — feat(am): add Account 360 overview with parent/child  
**Date:** 2026-09-05

## Summary

Replaced the Wave 2 `clients/[id]` placeholder with Account 360. Added `GET/PATCH /api/crm/am/accounts/:agencyClientId` (CLASS/JWT + `amScopeSql`; out-of-scope → **404 not 200**). Parent responses include `children[]`. PATCH updates ext (tier, team, status, parent) and name via AgencyService when the caller has agency write. No PATCH contract-amount route. 10 tabs; Wave 2 implements Tổng quan + Hợp đồng & Tài chính (read) + Audit. No Ads/Portal tabs.

## Backend

### GET `accounts/:agencyClientId` (`view`)

- Scope via `amScopeSql` (same actor rules as list). Missing / out-of-scope → 404 `not_found`.
- Payload: identity, lifecycle, health, tier, team, owner, Delivery/Media labels if derived, `children[]`, contacts, contracts, open tasks, plans, audit.
- Amounts (`mrr_vnd`, contract `amount_vnd`) null when `hide_amounts` (no `crm_am.finance` view / manage).

### PATCH `accounts/:agencyClientId` (`edit`)

- Ext: `tier`, `team_id`, `am_status`, `parent_agency_client_id`, `archive` (manage → `paused`).
- Name only through `AgencyService.updateClient` if `crm_agency` create/write.
- Ignores `amount_vnd`. Audit `account.update`.

### POST `accounts/:agencyClientId/merge` (`manage`)

- Body `{ into_agency_client_id }`. Out-of-scope / missing target → 403 `merge_denied` (UI tooltip).

## Frontend

- Header: name, lifecycle, health badge → `/health/[id]`, code, industry, tier, team, Owner ▾ (`assign` + transfer), Delivery/Media if present, Agency deep-link.
- Quick actions: Log / Tạo rủi ro W3 disable; Tạo việc; Bắt đầu gia hạn; Tạo cơ hội W4 disable; no AI.
- `⋮`: sửa / contact / đổi owner / lifecycle / archive (`manage`) / merge (`manage`, 403 tooltip).
- Other tabs: real heading + `Mở ở Wave n` (not 404).

## TDD Evidence

**RED** (before `get`):

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts-360.spec.ts --no-coverage
```

- TS2339: `Property 'get' does not exist on type 'AmAccountsService'` (feature missing).

**GREEN:**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-360.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts \
  src/am/am-accounts-transfer.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# 5 suites, 27 passed
```

Required cases: out-of-scope 404 not 200; parent returns `children[]`; no PATCH contract amount route.

Frontend vitest: `am-account-360.util.spec.ts` — 10 tabs, no Ads/Portal, Wave 2 implements overview/finance/audit.

## Files changed

- `services/ptt-crm-api/src/am/am-accounts.service.ts`
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am-accounts-360.spec.ts` (new)
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-account-360.util.ts` (new)
- `services/ops-web/src/lib/crm/am-account-360.util.spec.ts` (new)
- `services/ops-web/src/components/crm/am/AmAccount360.tsx` (new)
- `services/ops-web/src/app/crm/account-management/clients/[id]/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Concerns

1. **UI not browser-verified** — staff login required; verified via unit tests only.
2. **Merge is a thin Wave 2 action** — sets `parent_agency_client_id` on the source; not a full legal merge / identity collapse.
3. **Delivery/Media labels** are derived from contracts (`media` billing/slug vs other active HĐ), not dedicated owner columns.
4. **Contact add** deferred to Task 16; 360 lists existing `crm_am_contacts` only.
5. **Roster owner picker** still uses `staff_users.id` (transfer remaps to `crm_staff` by email), same as Task 14.

## Review follow-up (Important)

**Commit:** `fix(am): distinguish 360 load errors and validate parent patch`

Fixed three Important findings. UI still not browser-verified.

### 1. Load failure must not look like 404

`AmAccount360` already tagged `not_found` vs `load_failed`, but `!data` reused the scope-not-found sentence. Scope copy now only renders on HTTP 404. Other failures use `Không tải được Account 360. Thử lại.`

### 2. Name save without `crm_agency` write

PATCH with `name` and no `crm_agency` create/write skips `AgencyService.updateClient`, returns `name_unchanged: true`, and does not audit a name change. UI disables the name field and toasts `Tên không đổi — cần quyền crm_agency.write` (info), not success-as-changed.

### 3. Parent PATCH scope

Parent UUID/self → 400 `parent_invalid`. Missing / out-of-scope parent uses `loadScopedAccounts` (same as merge) → 403 `parent_denied` before UPDATE.

### RED

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts-360.spec.ts --no-coverage
TS2339: Property 'name_unchanged' does not exist on type 'AmAccount360'.

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-account-360.util.spec.ts
TypeError: am360LoadErrorKind is not a function
TypeError: canEditAmAccountName is not a function
```

### GREEN

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-360.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts \
  src/am/am-accounts-transfer.spec.ts \
  src/am/guards/staff-am.guard.spec.ts --no-coverage
# 5 suites, 30 passed

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-account-360.util.spec.ts
# 5 passed
```
