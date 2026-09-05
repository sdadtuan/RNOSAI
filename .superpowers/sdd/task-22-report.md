# Task 22 Report: Wave 2 UAT (local)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**HEAD:** `1e97bf02`  
**Date:** 2026-09-05

Plan: stop until PO signs Wave 2. No VPS apply, no prod RBAC, no Wave 3.

## Automated suites (this checkout)

```
cd services/ptt-crm-api && jest src/am --no-coverage
# 21 suites, 101 passed

cd services/ops-web && npx vitest run src/lib/crm/am-*.spec.ts
# 13 files, 50 passed
```

KPI Hub / CSD paths: `git diff --name-only 68d2dba2..HEAD` has **no** `kpi-hub` or `csd` file hits.

## Checklist

| # | Item | Local verdict | Evidence |
|---|---|---|---|
| 1 | List filters survive refresh (URL) | **Pass (code + util)** | `AmAccountsList` `router.replace(pathname?qs)`; `viewQueryFromSearch` / chips as URL presets (Task 13). Not browser-refreshed. |
| 2 | Parent An-Phú-style row expands children; each child has own owner/score | **Partial** | API: `parent_id`, `is_parent`, `child_count`, per-row `owner_*` / `score` (BR-022). 360 returns `children[]`. List is **flat** (parent shows “N công ty con”, child shows `parent_name`) — no accordion toggle. |
| 3 | Bulk transfer writes audit; old owner loses `me` scope | **Pass (Jest)** | `am-accounts-transfer.spec.ts`: audit `account.transfer`; out-of-scope UUID 403; owner written as `crm_staff.id`. |
| 4 | 360 has 10 tab labels; Ads/Portal absent | **Pass (Vitest)** | `am-account-360.util.spec.ts`: length 10; `am360HasForbiddenTabs() === false`. |
| 5 | Handover reject requires reason; accept opens onboarding | **Pass (Jest + UI)** | reject blank → 400 `reason_required`; accept writes case + `am_status=onboarding`; UI redirects to `/onboarding/{caseId}`. |
| 6 | Go-live blocked on required items | **Pass (Jest + Vitest)** | `required_open` when required undone and no override; `amGoLiveBlocked`. |
| 7 | Contract amount not editable | **Pass** | No PATCH/PUT/DELETE on `/api/crm/am/contracts*`; `AmContractDetail` has **zero** `<input>`/`<textarea>`. |
| 8 | Lost/Churned modal required fields | **Pass (Jest + Vitest)** | `lost_fields_required` without reason/date/lessons; recoverable tag alone is not lessons; `amRenewalLostError`. |
| 9 | Settings read-only without manage | **Pass (code + guard)** | PUT + publish + override are `manage`; UI `canManage` gates scorecard/template writes. |
| 10 | KPI Hub + CSD unchanged | **Pass (diff)** | No kpi-hub / csd paths in `68d2dba2..HEAD`. AM route prefix stays before `/crm`. |

## Wave 2 UAT gate (plan)

Parent/child data + Lost reason + Go-live gate + no contract amount edit: **met in API/tests**. Parent **expand accordion** is the only UI shortfall vs the UAT sentence.

## Not done (blocked on PO, same as Wave 1)

- Apply W2 DDL on live Postgres (`scorecard_version` ALTER included)
- Rebuild/deploy `ops-web` + `ptt-crm-api`
- Grant prod `crm_am` / `crm_am.finance`
- Browser UAT on `https://rs.pttads.vn`

## Concerns

1. No staff-session browser pass (handover modal, kanban, go-live, settings).
2. List parent/child is labeled, not a click-to-expand tree.
3. Window job is on-demand (`POST /renewals/window-job`), no OS cron.
4. SQL-backed tests are mocked.

DONE_WITH_CONCERNS
