# Task 7 Report: POST request + convert

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e0`  
**Status:** DONE

## What was implemented

POST create + convert for Content Requests. No GET insights. No demo brand seed. No DDL apply.

| Method | Path | Guard |
|---|---|---|
| POST | `/api/crm/content-os/portfolio/requests` | class view + method `StaffContentMarketingWriteGuard` |
| POST | `/api/crm/content-os/portfolio/requests/:id/convert` | class view + method write |

`createRequest({ lifecycleId, actor, body })`:

- Missing/blank `deliverable_ask` → `BadRequestException` (`status: 400`)
- `source` omitted → `account`; otherwise must be `account|client_portal|campaign|api|idea` (400)
- `triage_status = 'Submitted'`
- `display_code = formatContentRequestCode(now, repo.nextRequestSeq)`
- Completeness from `client_label`, `brand_label`, `deliverable_ask`, `objective`, `due_at`, `source`
- Persist via `repo.insertRequest`

`convertRequest({ requestId, actor, body })`:

- Load via `repo.getRequestById` — 404 if missing
- Only `Accepted` may convert (400 otherwise)
- Mark `Converted`, then `ContentItemService.createItem` with `title = deliverable_ask`, channel/format from body or `facebook` / `social_post`
- Portfolio-repo UPDATE sets item `request_id` + `display_code` (`formatContentItemCode` + `repo.nextItemSeq`)
- Returns `{ request, item }`

Actor: `req.staffUser?.email ?? 'unknown'` (internal → `'internal'`). Write guard provided on the portfolio module the same way Task 5 provided the view guard.

Unit tests are mock-based (Task 6 local DDL apply was skipped).

## TDD Evidence

### RED — request spec first (feature missing)

```
FAIL src/content-os-portfolio/content-os-portfolio.service.request.spec.ts
  ● Test suite failed to run

    TS2554: Expected 3 arguments, but got 4.
    TS2339: Property 'createRequest' does not exist on type 'ContentOsPortfolioService'.
    TS2339: Property 'convertRequest' does not exist on type 'ContentOsPortfolioService'.
```

Watched fail for missing methods / constructor arity — not typos.

### GREEN — implement service + repo + controller POSTs

```
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage

PASS src/content-os-portfolio/content-os-portfolio.util.spec.ts
PASS src/content-os-portfolio/publish-gate.util.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.service.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.service.request.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.controller.spec.ts

Test Suites: 5 passed, 5 total
Tests:       20 passed, 20 total
```

Request spec cases:

1. `rejects missing deliverable` (brief verbatim)
2. `creates Submitted with completeness and CR code` (brief verbatim)
3. `converts Accepted request and creates item with CNT code` (Accepted → Converted + `createItem` called)

## Files

- Create: `content-os-portfolio.service.request.spec.ts`
- Modify: `content-os-portfolio.service.ts` — `createRequest`, `convertRequest`, inject `ContentItemService`
- Modify: `content-os-portfolio.repository.ts` — `nextRequestSeq`, `insertRequest`, `getRequestById`, `updateRequestStatus`, `nextItemSeq`, `updateItemRequestLink`
- Modify: `content-os-portfolio.controller.ts` — POST routes + write guard
- Modify: `content-os-portfolio.module.ts` — provide `StaffContentMarketingWriteGuard`
- Modify: `content-os-portfolio.types.ts` — request row/write types
- Modify: `content-os-portfolio.service.spec.ts` — unused `createItem` stub for 4-arg constructor

## Concerns

1. **DDL not applied locally** — Task 6 skipped Postgres apply. Repo SQL is untested against a live DB; unit tests mock the repo.
2. Jest printed a worker teardown warning (`force exited`) after the green run; all 20 tests still passed.
