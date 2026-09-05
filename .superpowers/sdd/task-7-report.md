# Task 7 Report: Tạo khách + Tạo plan

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `6bf70726` — feat(am): wrap agency client create and seed AM plans  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am-accounts.service.ts` | Created — wrap `AgencyService.createClient` + UPSERT `crm_am_account_ext`; attach upserts ext only |
| `services/ptt-crm-api/src/am/am-accounts.service.spec.ts` | Created — create does not INSERT second customer table; attach skips `createClient` |
| `services/ptt-crm-api/src/am/am-plans.service.ts` | Created — renewal requires `contract_id`; unique → 409; seed tasks by kind |
| `services/ptt-crm-api/src/am/am-plans.service.spec.ts` | Created — renewal without contract → `{ error: 'contract_required' }` |
| `services/ptt-crm-api/src/am/am-http.ts` | Created — `amThrow` so tests match `{ error }` and Nest still serializes body |
| `services/ptt-crm-api/src/am/am.controller.ts` | Modified — `POST /api/crm/am/accounts`, `POST /api/crm/am/plans` + `RequireAmAction('edit')` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — `forwardRef(() => AgencyModule)` + register account/plan providers |
| `services/ptt-crm-api/src/am/am-tasks.service.ts` | Modified — export `isUuid` for plan validation |
| `services/ops-web/src/lib/crm/am-api.ts` | Modified — `createAmAccount` / `createAmPlan` |
| `services/ops-web/src/components/crm/am/AmCreateMenu.tsx` | Modified — Khách (Tạo mới / Gắn đã có) + Renewal/Plan drawers |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Modified — `openCreate` / `closeCreate` context |
| `services/ops-web/src/components/crm/am/AmDashboard.tsx` | Modified — empty-book **Tạo khách** opens client drawer |
| `services/ops-web/src/app/crm/account-management/am.css` | Modified — tabs + attach list |

**Not done (out of scope):** palette (Task 8). `.superpowers/` not committed.

## TDD evidence

### RED — specs before services

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage

FAIL src/am/am-accounts.service.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module './am-accounts.service'

FAIL src/am/am-plans.service.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module './am-plans.service'
```

### GREEN

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage

PASS src/am/am-accounts.service.spec.ts
PASS src/am/am-plans.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       3 passed, 3 total
```

Brief assertions: `agency.createClient` called on create; no `INSERT INTO clients` with `am_` via AM db; attach does not call `createClient`; renewal without `contract_id` → `{ error: 'contract_required' }`.

## Behavior

- `POST /api/crm/am/accounts` `mode=create` — requires `crm_agency` create **or** write (or internal key). Else 403 `{ error: 'agency_write_required', fallback: '/agency/clients/new' }`. Then `AgencyService.createClient` + UPSERT ext. Never INSERT a second customer table.
- `mode=attach` — 404 `{ error: 'client_not_found' }` if `clients.id` missing; UPSERT ext only.
- `POST /api/crm/am/plans` — renewal without `contract_id` → 400 `{ error: 'contract_required' }`. Unique `(tenant, client, kind, period_key)` → 409 `{ error: 'duplicate_plan' }`.
- Seed titles: qbr 3 / renewal 3 / care 2 / expand 2 as listed in the brief.
- UI: + Tạo mới menu — Khách / Việc / Renewal-plan. Cơ hội + Log still disabled Wave 3/4. Client form matches `/agency/clients/new` (code, name, industry_slug, owner). Tab **Gắn đã có** searches `GET /api/v1/clients?q=`.

## Concerns

- Attach search uses Agency list API (`crm_agency` view). Users with AM edit but no Agency view see empty hits; they can still fail closed rather than invent a second catalog.
- Create-client / create-plan not exercised in a logged-in browser this task (staff auth required).
- UI agency-write check is create **or** write; Agency page badge still create-only (`canAgencyWrite`).

## Review fixes (Important)

**Date:** 2026-09-05  
**Commit:** `fd0d364d` — fix(am): require renewal contract, keep attach owner, wrap plan seed

1. **Renewal `contract_id`** — reject unless `Number(contract_id) > 0`. Empty string, `0`, and `"0"` → 400 `{ error: 'contract_required' }`. Spec: `renewal plan with contract_id %j is 400 contract_required`.
2. **Attach owner first-writer-wins** — `COALESCE(crm_am_account_ext.account_owner_staff_id, EXCLUDED.account_owner_staff_id)` plus comment. Spec: `attach does not overwrite an existing owner`.
3. **Plan seed compensate** — insert plan, then seed via `AmTasksService` (separate pool). On seed throw, `DELETE` the plan (`deleteById`) so retry is not 409-stuck. Spec: `deletes the plan when seed tasks fail so retry is not 409-stuck`.
4. **Minor** — production `inserts: string[]` spy removed from `AmAccountsRepository`; spy stays in the spec only.

### GREEN (re-run)

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-accounts.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage

PASS src/am/am-accounts.service.spec.ts
PASS src/am/am-plans.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```
