# Task 30 Report: Wave 3 UAT (local)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**HEAD:** `f8ea7083`  
**Date:** 2026-09-05

Plan: stop until PO signs Wave 3. No VPS apply, no prod RBAC, no Wave 4.

## Automated suites (this checkout)

```
cd services/ptt-crm-api && jest src/am --no-coverage
# 24 suites, 123 passed

cd services/ops-web && npx vitest run src/lib/crm/am-*.spec.ts
# 18 files, 60 passed
```

AM module does not import `CsdTicketsService`. No `AmAiDrawer` in AM components.

## Checklist

| # | Item | Local verdict | Evidence |
|---|---|---|---|
| 1 | Queue board/list/week stay in sync after accept | **Pass (code)** | One `GET /tasks`; views are client filters of the same `items`. Bulk/single accept mutate then reload. Not browser-clicked. |
| 2 | Breach banner on detail | **Pass (Jest + Vitest)** | `amWorkItemBreached` = overdue && !paused; red `Resolution SLA breached`. |
| 3 | Escalate creates notify; CSD ticket still open | **Pass (Jest)** | INSERT `crm_am_notifications`; mocked CSD `resolve` never called; no CSD import. |
| 4 | Timeline system events not editable | **Pass (Jest)** | PATCH system / `audit:*` → 409 `system_readonly`. |
| 5 | Critical without recovery shows blocking banner | **Pass (Jest + UI)** | Care plan 409 `recovery_required`; 360 + health `recovery_required` banner. |
| 6 | SLA% vs CSD same filter | **Pass (Jest)** | Shared `csdSlaRate`; 10-ticket fixture AM === CSD → 70. |
| 7 | AI still absent | **Pass (diff)** | No AM AI drawer/service; create-menu has no AI extract. |

## Wave 3 UAT gate (plan)

Breach banner · no CSD Resolve · Critical requires recovery: **met in API/tests**.

## Not done (blocked on PO)

- Apply W3 DDL on live Postgres
- Browser UAT (queue views, escalate, timeline, Critical banner)
- Deploy `ops-web` + `ptt-crm-api`
- Close-recovery UI is API-only (outcome + lesson enforced on POST close)

## Concerns

1. No staff-session browser pass.
2. List/board/week sync is the same payload, not three live queries.
3. Health `sla_pct` is a caption, not a 7th tile (correct).

DONE_WITH_CONCERNS
