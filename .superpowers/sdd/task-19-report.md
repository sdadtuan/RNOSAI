# Task 19 Report: Contract catalog + detail (UI-AM-10)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `9dcf49f1` — feat(am): add read-only contract catalog and detail  
**Date:** 2026-09-05

## Summary

Read-only contract catalog and detail on existing SoR `crm_contracts`. AM never edits `amount_vnd` or legal terms. Amounts hide unless `crm_am.finance` view or `crm_am` manage (internal key without staffUser shows). 360 already links to `/crm/account-management/contracts/{id}`. No new nav item. No catalog page.

## Backend

`AmContractsService` + CLASS `AmContractsRepository` registered in `am.module.ts`. GET only on `am.controller.ts`:

- `GET /api/crm/am/contracts?agency_client_id&scope` (`view`) — optional UUID filter else 400 `invalid_agency_client_id`
- `GET /api/crm/am/contracts/:id` (`view`) — non-integer / ≤0 → 400 `invalid_contract_id`; out of `amScopeSql` → 404 `not_found`

Join: `TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text` plus `clients`. Hide via copied `shouldHideAmounts`. MRR via `monthlyRecurringVnd` (media/project/one_off → null; annual/12). `days_remaining` is ICT calendar date vs `ends_on` (missing end → null).

Detail extras: `notes`, `renewal_reminder_days`, `signed_on`; one derived `line_items` row from slug+title (or `[]`); `obligations` / `payment_schedule` / `amendments` / `documents` = `[]`; `renewal.open_case_id` from `crm_am_renewal_cases` where status NOT IN (`renewed`,`lost`); audit last 20 `crm_contract_events` (missing table → `[]`, catch 42P01).

## Frontend

`AmContractDetail` at `/crm/account-management/contracts/[id]`. Header: reference/title · client · dates · `Còn {n} ngày` or `—` · status pill. Tabs: Tổng quan · Dịch vụ & giá · Lịch thanh toán · Gia hạn · Phụ lục · Tài liệu · Audit (`?tab=`). Amounts via `amContractAmountDisplay` / `vnd()` / `—`. Zero amount inputs. Payments = Wave 4 placeholder. Renewal links `/crm/account-management/renewals/{id}` when a case is open. Loading/error/empty like 360 (`—`, Retry).

## TDD evidence

**RED** (modules missing):

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-contracts.service.spec.ts --no-coverage
# TS2307: Cannot find module './am-contracts.service'

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-contract.util.spec.ts
# Cannot find module './am-contract.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-contracts.service.spec.ts --no-coverage
# 1 suite, 3 passed

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-contract.util.spec.ts
# 1 file, 3 passed
```

Required: actor without `crm_am.finance` view (and without manage) → `hide_amounts: true`, `amount_vnd` and `mrr_vnd` null even when SQL returned 1_020_000_000. Finance view maps `amount_vnd`; media `billing_type` still `mrr_vnd: null`. `AmController` metadata has no Patch/Put/Delete path containing `contracts`. Vitest: seven tab labels; `amContractAmountDisplay(hide, amount)` → `—` when hide or null.

Also re-ran `am-accounts-360.spec.ts` (13 passed), including the existing “no PATCH amount on a contract endpoint” lock.

## Files

- `services/ptt-crm-api/src/am/am-contracts.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-contract.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmContractDetail.tsx`
- `services/ops-web/src/app/crm/account-management/contracts/[id]/page.tsx`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view` only; hide is a service flag, not 403.
- CLASS repository; no type-only token.
- No PATCH / PUT / DELETE / POST on `/api/crm/am/contracts*`.
- No `<input>` / `<textarea>` bound to `amount_vnd` or legal terms.
- No mockup hard-codes (1.020.000.000, 85tr, HD-2026-0084).
- No nested `<main>`, no new npm packages, no KPI Hub / CSD CSS.

## Concerns

1. **SQL is mocked** — hide_amounts / media MRR are not proven against live Postgres.
2. **No component or browser pass** — tab URL, Retry, and hidden `—` are untested in ops-web UI.
3. **No catalog list page** — list API exists; thin `?agency_client_id=` list was optional and skipped.
4. **Line items are derived** — one row from `service_slug` + `title` + amount/dates; no SKU table on `crm_contracts`.

DONE_WITH_CONCERNS
