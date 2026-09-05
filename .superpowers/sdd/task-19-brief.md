# Task 19: Contract catalog + detail (UI-AM-10)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 19 in `docs/superpowers/plans/2026-09-05-account-management-os.md`
- SRS UI-AM-10 / BR-002: SoR = `crm_contracts`; AM never edits `amount_vnd` / legal terms
- Mockup `#page-contract` in `docs/design/rnosai-am-os-srs-mockup.html`
- Join pattern already used: `TRIM(COALESCE(ct.agency_client_id, '')) = e.agency_client_id::text` (see `am-accounts.service.ts` `loadContracts` / `contractJoins`)
- Hide amounts: copy `shouldHideAmounts` from `AmAccountsService` — hide unless `crm_am.finance` `view` **or** `crm_am` `manage` (internal key without staffUser → show). Flag `hide_amounts` on every response. When hidden, money fields are `null` (UI `—`).
- MRR: `monthlyRecurringVnd` in `am-money.util.ts` (media/project/one_off → null; annual/12)
- Days remaining: ICT calendar date vs `ends_on`. Missing `ends_on` → `days_remaining: null`
- Scope: `resolveAmScope` + `amScopeSql` on `crm_am_account_ext`. Out-of-scope GET → 404 `not_found`
- Invalid id (non-integer / ≤0) → 400 `invalid_contract_id`

## Do not

- Add PATCH / PUT / DELETE / POST for `/api/crm/am/contracts*`
- Any `<input>` / `<textarea>` bound to `amount_vnd` or legal term fields
- Hard-code mockup money (1.020.000.000, 85tr, HD-2026-0084)
- Nested `<main>`, new npm packages, KPI Hub / CSD CSS
- Type-only Nest repository tokens — new `AmContractsRepository` must be a `@Injectable()` CLASS
- Invent line-item / appendix / invoice tables (they do not exist on `crm_contracts`)
- Commit `.superpowers/` or `node_modules`

## Files

**New:** `services/ptt-crm-api/src/am/am-contracts.service.ts` (+ spec)  
**Edit:** `am.controller.ts`, `am.module.ts` (register CLASS providers)  
**New UI:** `services/ops-web/src/components/crm/am/AmContractDetail.tsx`  
**Replace:** `app/crm/account-management/contracts/[id]/page.tsx`  
**API:** `lib/crm/am-api.ts`  
**Util+vitest:** `lib/crm/am-contract.util.ts` (+ spec)

360 already links to `/crm/account-management/contracts/{id}`. No new nav item. No catalog page unless you add a thin list under the same component when `?agency_client_id=` is present — optional, not required.

## APIs

```
GET /api/crm/am/contracts?agency_client_id&scope     // view
GET /api/crm/am/contracts/:id                       // view
```

`agency_client_id` optional on list. If present must be UUID else 400.

### List item

```
id (number), reference_code, title, status, billing_type, service_slug,
starts_on, ends_on, days_remaining, amount_vnd, mrr_vnd,
agency_client_id, client_name, client_code, hide_amounts
```

### Detail (same money rules)

Plus:
- `notes` (read-only text)
- `renewal_reminder_days`
- `signed_on`
- `mrr_vnd` via `monthlyRecurringVnd` (null if hidden **or** non-recurring)
- `line_items`: if no line-item table, **one** derived row from `service_slug` + `title` + `amount_vnd`/`starts_on`/`ends_on`/`status`, or `[]` if slug+title empty. Do not fake extra SKUs
- `obligations`: `[]` Wave 2
- `payment_schedule`: `[]` (W4)
- `amendments`: `[]`
- `documents`: `[]`
- `renewal`: `{ ends_on, days_remaining, open_case_id }` — `open_case_id` from `crm_am_renewal_cases` where status NOT IN ('renewed','lost') for this `contract_id`, else null
- `audit`: last 20 rows from `crm_contract_events` if table exists (`event_type`, `actor`, `created_at`, `payload_json`); missing table → `[]` (catch 42P01 like other AM loaders)
- `hide_amounts: boolean`

## UI `AmContractDetail`

Header: `{reference_code or title}` · `{client_name}` · `{starts}–{ends}` · `Còn {days} ngày` or `—` · status pill.

Tabs **exactly** (labels): Tổng quan · Dịch vụ & giá · Lịch thanh toán · Gia hạn · Phụ lục · Tài liệu · Audit  
`?tab=overview|services|payments|renewal|amendments|documents|audit`

- Tổng quan: amount, MRR, billing, dates, notes — all read-only. Amounts via `vnd()` / `—` when null
- Dịch vụ & giá: table; unit price `—` when hidden
- Lịch thanh toán: Wave 4 placeholder (`AmPlaceholder` or muted “Sóng 4”)
- Gia hạn: ends_on, days, reminder; if `open_case_id` link `/crm/account-management/renewals/{id}`
- Phụ lục / Tài liệu: `—`
- Audit: events or `—`

**Zero** amount inputs. Loading/error/empty like 360 (`—`, Retry).

## Tests (TDD)

Jest `am-contracts.service.spec.ts`:

1. Actor **without** `crm_am.finance` view (and without manage) → `hide_amounts: true`, `amount_vnd` and `mrr_vnd` are `null` even if SQL returned 1_020_000_000
2. Actor **with** finance view → amounts mapped; media `billing_type` still `mrr_vnd: null`
3. PATCH must not exist: assert `AmController` prototype / metadata has **no** Patch/Put/Delete handler whose path includes `contracts` (import controller + `@nestjs/common` PATH metadata, or a dedicated tiny spec). Do **not** add a dummy PATCH to test 404.

Vitest: tab labels; `amContractAmountDisplay(hide, amount)` → `—` when hide or null.

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-contracts.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-contract.util.spec.ts
```

If worktree jest binary missing, use main repo jest with `--config` / `--rootDir` on this worktree (see Task 18-FIX report).

## Commit

`feat(am): add read-only contract catalog and detail`

HEREDOC. Never `--no-verify`. Never update git config.

## Report

`.superpowers/sdd/task-19-report.md` with RED/GREEN.

Final line: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
