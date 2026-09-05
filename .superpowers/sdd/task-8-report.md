# Task 8 Report: Command palette ⌘K

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `29e357fb` — feat(am): add scoped command palette search  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am-search.service.ts` | Created — scoped UNION search (account / contract / task) + `rankAmSearchItems` |
| `services/ptt-crm-api/src/am/am-search.service.spec.ts` | Created — 1-char empty; view user cannot see other owner; exact code first |
| `services/ptt-crm-api/src/am/am.controller.ts` | Modified — `GET /api/crm/am/search?q=` + `@RequireAmAction('view')` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — register `AmSearchRepository` + `AmSearchService` |
| `services/ops-web/src/lib/crm/am-api.ts` | Modified — `fetchAmSearch` |
| `services/ops-web/src/components/crm/am/AmPalette.tsx` | Created — ⌘/Ctrl+K, Esc, Enter, 300ms debounce |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Modified — search box opens `AmPalette` |
| `services/ops-web/src/app/crm/account-management/am.css` | Modified — palette + search-button styles |

**Not done (out of scope):** Contact / Renewal groups (Wave 2). `.superpowers/` not committed.

## TDD evidence

### RED — spec before service

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-search.service.spec.ts --no-coverage

FAIL src/am/am-search.service.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module './am-search.service'
```

Failure reason matches the brief: module/exports missing, not a typo.

### GREEN

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-search.service.spec.ts --no-coverage

PASS src/am/am-search.service.spec.ts
  AmSearchService
    ✓ returns empty items for 1-char query
    ✓ view user cannot see other owner
    ✓ ranks exact client code first

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Brief assertions: `q='a'` → `{ items: [] }` and no DB; view + `scope=all` still applies `amScopeSql` me (`e.account_owner_staff_id`, staff id in params, not `AND TRUE`); `AP01` exact code ranks before name ILIKE.

## Behavior

- `GET /api/crm/am/search?q=` — cap `view`. `q.trim().length < 2` → `{ items: [] }` (not 500), no query.
- Groups Wave 1: `account` | `contract` | `task`. Each join `crm_am_account_ext e` and `amScopeSql` — never returns out-of-scope accounts. View user cannot escalate to `all`.
- Account match: exact `clients.code ILIKE q` first (SQL `ORDER BY` + JS `rankAmSearchItems`), then `name ILIKE %q%`.
- Missing `crm_contracts` → retry without the contract UNION.
- UI: header search + ⌘/Ctrl+K open palette; Esc closes; Enter opens. Account → `/crm/account-management/clients/[id]` (Wave 1 placeholder). Debounce 300ms. Empty: **Không tìm thấy** + **Tạo khách** if `edit`.

## Concerns

- Palette not exercised in a logged-in browser this task (staff auth required).
- Contract/task hrefs go to Wave 2/3 placeholders (`/contracts/[id]`, `/work/[id]`).
- View-user scope test inspects SQL + params (mocked DB); no live Postgres proof that an other-owner row is excluded.
- Contact / Renewal groups deferred to later waves.

## Review fixes (Critical + Important)

**Critical:** `AmSearchService` now injects `AmSearchRepository` (class token), matching `AmAccountsRepository` pattern — Nest can resolve DI at boot.

**Important:** `am-search.service.spec.ts` asserts `amScopeSql` on each UNION arm (account / contract / task) via `unionArms()`, not once on the concatenated SQL.

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-search.service.spec.ts --no-coverage

PASS src/am/am-search.service.spec.ts
  AmSearchService
    ✓ returns empty items for 1-char query
    ✓ view user cannot see other owner
    ✓ ranks exact client code first

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```
