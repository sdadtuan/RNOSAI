# Task 10 Report: Requests UI + modal

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e0`  
**Commit:** `feat(cmkte): operate Content Request intake from COS modal`  
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
