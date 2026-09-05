# Task 16 Report: Create/Edit account + Contact drawer (UI-AM-05/06)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `2a509a37` — feat(am): add account form and contact drawer  
**Date:** 2026-09-05

## Summary

Full-page create at `/crm/account-management/clients/new` reuses Task 7 `POST /api/crm/am/accounts`. Edit at `/clients/[id]/edit` uses Task 15 PATCH. Active without a primary contact is 400 `primary_contact_required`. 360 ⋮ Sửa navigates to the edit form; ⋮ Contact opens `AmContactDrawer`. Dirty leave uses `window.confirm` (BR-024). “Lưu và tạo onboarding” saves `am_status=onboarding` then navigates to `/onboarding?agency_client_id=` (Task 18 placeholder).

## Backend

`PATCH /api/crm/am/accounts/:id` now:

- Rejects `{ am_status: 'active' }` unless a primary contact exists in `crm_am_contacts` or in `body.contacts` → 400 `{ error: 'primary_contact_required' }`.
- Upserts `body.contacts` (name, buying-committee role, sentiment, channel, renewal attitude, email, phone, is_primary).
- Accepts `owner_staff_id` and `tags` (tags audited only — no ext column).
- Still UUID-validates the account id (404 `not_found`) and scopes via `amScopeSql`.

## Frontend

- `AmAccountForm` — identity *, owner, contacts (≥1 primary when Active), BĐS extras when industry matches, tags. CTA: Hủy · Lưu nháp (`pending_handover`) · Lưu và tạo onboarding · Lưu.
- `AmContactDrawer` — name, role, sentiment, Gọi/Email/Zalo, renewal attitude.
- List “Tạo khách” and + menu “Khách (form đầy đủ)” → `/clients/new`.

## TDD evidence

**RED** (before PATCH gate):

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts-360.spec.ts --no-coverage -t primary_contact_required
Received promise resolved instead of rejected
```

Frontend utils: `Cannot find module './am-account-form.util'`.

**GREEN:**

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-accounts-360.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts \
  src/am/am-accounts-transfer.spec.ts --no-coverage
# 4 suites, 22 passed

$ cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/crm/am-account-form.util.spec.ts \
  src/lib/crm/am-contact-drawer.util.spec.ts \
  src/lib/crm/am-account-360.util.spec.ts
# 3 files, 9 passed
```

Required case: Active without primary contact → 400 `primary_contact_required` (no ext UPDATE). Incoming primary contact allows Active.

## Files

- `services/ptt-crm-api/src/am/am-accounts.service.ts`
- `services/ptt-crm-api/src/am/am-accounts-360.spec.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-account-form.util.ts` (+ spec)
- `services/ops-web/src/lib/crm/am-contact-drawer.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmAccountForm.tsx`
- `services/ops-web/src/components/crm/am/AmContactDrawer.tsx`
- `services/ops-web/src/app/crm/account-management/clients/new/page.tsx`
- `services/ops-web/src/app/crm/account-management/clients/[id]/edit/page.tsx`
- `services/ops-web/src/components/crm/am/AmAccount360.tsx`
- `services/ops-web/src/components/crm/am/AmAccountsList.tsx`
- `services/ops-web/src/components/crm/am/AmCreateMenu.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

## Concerns

1. **Tags are not persisted** — `crm_am_account_ext` has no `tags` column; PATCH records them in audit only.
2. **BĐS custom fields / website / timezone / package** are form-only (no Agency columns wired).
3. **Create still needs `crm_agency` create/write** (Task 7). Code auto-suggests if blank (`AM` + slug).
4. **UI not browser-verified** — staff login required; verified via unit tests only.
5. **Onboarding CTA is a navigate stub** — no handover/onboarding API yet (Task 17/18).
6. **Primary-contact gate** now also covers contacts-only PATCH / drawer when the resulting status is Active. Name/tier/industry-only PATCH on an already-Active account still does not re-check existing contacts.

## Review follow-up (Important)

**Commit:** `fix(am): make account form idempotent and enforce primary contact`

Fixed seven Important findings. UI still not browser-verified.

### 1. Create retry is idempotent

After `POST` succeeds, the form stores `createdId` and `router.replace`s to `/clients/:id/edit`. Retry / patch failure never calls create again (`amAccountSaveId`).

### 2. Named primary when resulting status is Active

If resulting `am_status` is `active` and the body sets `am_status: 'active'` or upserts `contacts`, PATCH requires ≥1 named primary (incoming or surviving). Contacts-only / drawer included → 400 `primary_contact_required`.

### 3. Validate before upsertContacts

`am_status` and `parent_agency_client_id` are validated before any `crm_am_contacts` write.

### 4. Owner change needs `crm_am.assign`

Changing `owner_staff_id` is 403 `missing_cap` / `assign`. Same owner is allowed for edit-only. Form disables the owner field and omits the patch without assign.

### 5. Industry persists on edit

PATCH accepts `industry` / `industry_override` → `crm_am_account_ext.industry_override`. Callers with `crm_agency` write also get `AgencyService.updateClient({ industry_slug })`.

### 6. Dirty leave intercepts in-app exits

Breadcrumb and Agency links use `amGuardDirtyClick` → `amConfirmLeave` (BR-024). Hủy still uses `amConfirmLeave`.

### 7. Contact drawer stays open on PATCH error

`onPatch` returns `false` on failure; drawer only `setEditing(false)` / closes on success. PATCH error (including `primary_contact_required`) is shown on the drawer.

### RED

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-accounts-360.spec.ts --no-coverage -t "contacts-only|validates am_status|rejects owner_staff_id|allows same owner|writes Agency industry"
# contacts-only resolved instead of 400
# contact upserts ran before am_status/parent 400
# owner_staff_id change resolved without assign
# UPDATE ext lacked industry_override; updateClient not called

$ cd services/ops-web && node node_modules/.bin/vitest run \
  src/lib/crm/am-account-form.util.spec.ts \
  src/lib/crm/am-contact-drawer.util.spec.ts
# amAccountSaveId / amGuardDirtyClick / amOwnerStaffPatch / amShouldCloseContactEdit not functions
```

### GREEN

```
$ cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-accounts-360.spec.ts \
  src/am/am-accounts.service.spec.ts \
  src/am/am-accounts-list.spec.ts \
  src/am/am-accounts-transfer.spec.ts --no-coverage
# 4 suites, 27 passed

$ cd services/ops-web && node node_modules/.bin/vitest run \
  src/lib/crm/am-account-form.util.spec.ts \
  src/lib/crm/am-contact-drawer.util.spec.ts \
  src/lib/crm/am-account-360.util.spec.ts
# 3 files, 13 passed
```
