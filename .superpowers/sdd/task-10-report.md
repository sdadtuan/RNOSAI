# Task 10 Report: Requests UI + modal

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e0`  
**Commit:** `8d3214ea` — `feat(cmkte): operate Content Request intake from COS modal`  
**Status:** DONE

## What was implemented

Content Request Intake is a real COS screen. The stub modal is a form. Command Center ＋ opens the same modal.

| Surface | Behavior |
|---|---|
| Validator | `validateRequestForm` verbatim in `cmkte-request-form.ts` |
| Submit | Missing required field → message, no POST. `lifecycle_id` must be number > 0 |
| Create | `POST /api/crm/content-os/portfolio/requests` — toast (not `alert`), local badge +1, stay on Intake |
| Convert | **Triage & create** only when `triage_status === 'Accepted'` → `POST .../convert` → `cmktePath('workspace', itemId)` |
| List | `GET /api/crm/content-os/portfolio/requests` → `{ items }` from scoped `cmkt_content_requests`, or `{ items: [] }` if table/PG missing |
| Ideas | Merge only when `?lifecycle=` is a known id; `status != converted` labeled source `idea`. No lifecycle → skip. No seed |

Form required: Client/Brand, Nguồn (`account\|client_portal\|campaign\|api\|idea`), Deliverable, Objective, Due, Priority, Lifecycle ID. No Sunlight/Nova/Tâm An. No “Gọi ngay”. Submitted rows are not converted and are not auto-marked Accepted.

## TDD Evidence

### RED — validator module missing

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/cmkte-request-form.spec.ts

Error: Cannot find module './cmkte-request-form'
```

Watched fail for missing module — not a typo.

### GREEN — validator + submit helper

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/cmkte-request-form.spec.ts

✓ src/lib/crm/cmkte-request-form.spec.ts (4 tests)

Test Files  1 passed (1)
     Tests  4 passed (4)
```

Cases: missing deliverable → message; valid → null; missing deliverable → no POST; valid → POST body.

### RED — GET list missing

```
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage

TS2339: Property 'listRequests' does not exist on type 'ContentOsPortfolioService'.
TS2339: Property 'listRequests' does not exist on type 'ContentOsPortfolioController'.
```

### GREEN — list + UI helpers

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/cmkte-request-form.spec.ts src/lib/crm/cmkte-api.spec.ts
# 2 files, 9 tests passed

cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage
# 5 suites, 28 tests passed
```

## Files

- Create: `services/ops-web/src/lib/crm/cmkte-request-form.ts` + spec
- Create: `services/ops-web/src/app/crm/content-os/requests/page.tsx`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktERequests.tsx`
- Modify: `services/ops-web/src/components/content-os/cmkte/CmktERequestModal.tsx` — real form
- Modify: `services/ops-web/src/components/content-os/cmkte/CmktECommandCenter.tsx` — same modal + toast
- Modify: `services/ops-web/src/lib/crm/cmkte-api.ts` + spec — list + convert
- Modify: `services/ops-web/src/styles/cmkte.css` — form / toast / tags
- Modify: portfolio controller / service / repository + specs — `GET .../requests`

## Concerns

- Ideas merge only when `?lifecycle=` is present. Portfolio-wide idea union was skipped so we do not invent a client/lifecycle.
- GET list and POST create are untested against a live `cmkt_content_requests` table (Task 6 DDL apply was skipped). Empty `{ items: [] }` is the fallback.
- Hub/Intake still duplicate shell auth/refresh (Task 8 leftover).
- Browser flow (login → modal → toast → convert) was not exercised; no local ops-web server was running.

## Fix

Review: unconverted ideas never appeared on default `/crm/content-os/requests` because merge required `?lifecycle=`.

**Covering files**
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts` — `listRequests` unions `ContentMarketingRepository.listIdeas` on the same staff-scoped lifecycle ids (cap 20). Skip converted/archived; skip a lifecycle if `listIdeas` throws. Empty client/brand — no Sunlight/Nova/Tâm An.
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.spec.ts` — merge / empty / skip-throw cases
- `services/ops-web/src/lib/crm/cmkte-api.ts` — `mapIntakeRows` + `filterPortfolioRequests`
- `services/ops-web/src/lib/crm/cmkte-api.spec.ts` — GET idea items render without `?lifecycle=`; convert hidden unless real `Accepted` request
- `services/ops-web/src/components/content-os/cmkte/CmktERequests.tsx` — uses mapper
- `services/ops-web/src/app/crm/content-os/requests/page.tsx` — default list is GET `{ items }` (ideas included); `?lifecycle=` only filters

Command Center metrics unchanged.

### RED

```
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage

FAIL src/content-os-portfolio/content-os-portfolio.service.spec.ts
  ● ContentOsPortfolioService.listRequests › merges unconverted ideas from scoped lifecycles without inventing clients
    Expected length: 2
    Received length: 1
  ● ContentOsPortfolioService.listRequests › skips a lifecycle when listIdeas throws
    Expected length: 2
    Received length: 1

Test Suites: 1 failed, 4 passed, 5 total
Tests:       2 failed, 29 passed, 31 total
```

```
cd services/ops-web && npx vitest run src/lib/crm/cmkte-request-form.spec.ts src/lib/crm/cmkte-api.spec.ts

 FAIL  src/lib/crm/cmkte-api.spec.ts > mapIntakeRows > shows idea items from GET without a lifecycle query
TypeError: (0 , mapIntakeRows) is not a function

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 9 passed (10)
```

### GREEN

```
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage

PASS src/content-os-portfolio/content-os-portfolio.util.spec.ts
PASS src/content-os-portfolio/publish-gate.util.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.controller.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.service.request.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.service.spec.ts

Test Suites: 5 passed, 5 total
Tests:       31 passed, 31 total
```

```
cd services/ops-web && npx vitest run src/lib/crm/cmkte-request-form.spec.ts src/lib/crm/cmkte-api.spec.ts

 ✓ src/lib/crm/cmkte-request-form.spec.ts (4 tests)
 ✓ src/lib/crm/cmkte-api.spec.ts (6 tests)

 Test Files  2 passed (2)
      Tests  10 passed (10)
```

## Fix

Review: `mapIntakeRows` treated every `source === 'idea'` as a non-convertible backlog idea, hiding **Triage & create** for Accepted `CR-*` rows created from ideas.

**Covering files**
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.types.ts` — `kind: 'request' | 'idea'` on list items
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts` — real rows emit `kind: 'request'`
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts` — synthetic GET ideas emit `kind: 'idea'`
- `services/ops-web/src/lib/crm/cmkte-api.ts` — `isSyntheticIdeaRow` discriminates by `kind` / `IDEA-*` prefix; convert keyed to real request ids only
- `services/ops-web/src/lib/crm/cmkte-api.spec.ts` — `CR-*` + `source: 'idea'` + `Accepted` → `canConvert: true`; `IDEA-*` → `canConvert: false`

### RED

```
cd services/ops-web && npx vitest run src/lib/crm/cmkte-api.spec.ts

 FAIL  src/lib/crm/cmkte-api.spec.ts > mapIntakeRows > allows convert for Accepted CR rows even when source is idea
AssertionError: expected { key: 'idea-3', kind: 'idea', …(10) } to match object { kind: 'request', …(3) }

- Expected
+ Received

  {
-   "canConvert": true,
-   "kind": "request",
-   "requestId": 12,
+   "canConvert": false,
+   "kind": "idea",
+   "requestId": null,
    "source": "idea",
  }

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

### GREEN

```
cd services/ops-web && npx vitest run src/lib/crm/cmkte-api.spec.ts

 ✓ src/lib/crm/cmkte-api.spec.ts (8 tests)

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

```
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage

Test Suites: 5 passed, 5 total
Tests:       31 passed, 31 total
```
