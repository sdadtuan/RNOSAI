# Task 7 Report — CPA report + OVR chips

**Branch:** `feat/cp-ai-ops`  
**HEAD before:** `154902497e5f172d69865b72e0b99ddcdd4b7c91`  
**Commit:** `578b0ec1` `feat(cp): cost per approved asset slice and AI Ops chips.`  
**Status:** DONE_WITH_CONCERNS

## Summary

Credit report now exposes a north-star CPA slice. Denominator 0 yields `cpa === null` (FE `—`), never `0`. Project overview (`?tab=overview`) shows real Weave / Magnific / Comfy count chips linked with `aiOpsHref`. Health `getHealth()` lists `weavy` / `magnific_*` / `comfyui` when those jobs appear in the 60-minute window; an empty window still returns stub.

## What shipped

### Credit CPA (`cp-reports.service.ts`)

Payload additions (verbatim):

```ts
cpa: number | null; // null → FE —
cpa_numerator: number | null;
cpa_denominator: number; // approved count; 0 → cpa null
by_provider: Array<{ provider: string; charged: number | null }>;
```

- **Numerator:** same ledger filter as existing `charged` (`kind = 'charge'`, scoped projects, ICT range). Null when there are no charge rows.
- **Denominator:** `COUNT` of `crm_cp_video_versions.approval_status = 'final_approved'` (same executive `output_final` join) **plus** Weave assets in `lane IN ('approved', 'final')`. No `approval_status` column was added to `crm_cp_asset_versions`.
- **CPA:** `null` when `cpa_denominator === 0`; otherwise `(cpa_numerator ?? 0) / cpa_denominator`.
- **`by_provider`:** `GROUP BY` ledger `provider` for `kind = 'charge'` only. Ledger kinds stay `charge` / `reserve` / `release`. `charged` is null when that grouped row has no amount.

### Credit UI

- `CpReports.tsx` credit tab: CPA tile (`—` when null) + by_provider table.
- `CP_REPORT_SECTIONS.credit` is now `['by_pipeline', 'by_provider']`.

### PRJ-03 overview chips

`getProject` / `decorateWorkspace` adds:

| Field | Query | 0 rows |
|---|---|---|
| `weave_open_count` | `crm_cp_weave_work_orders` where `status NOT IN ('cancelled', 'delivered')` | `null` |
| `magnific_job_count` | `crm_cp_render_jobs` with `provider LIKE 'magnific%'` (via `project_id` or draft) | `null` |
| `comfy_job_count` | same jobs table, `provider = 'comfyui'` | `null` |

Chips on `CpProjectWorkspace` overview link to `aiOpsHref(projectId, 'weave'|'magnific'|'comfy')`. Display uses `formatAiOpsCount` so `null` / `0` render as `—`.

### Health providers

- Empty 60-minute window: still `[{ id: 'stub', success_pct: null, p95_sec: null }]`.
- Non-empty: one row per provider that actually appears (including `weavy`, `magnific_mcp`, `magnific_rest`, `comfyui`).
- `success_pct` is null when that provider has no terminal (`completed`/`failed`) jobs.
- Health SQL now joins `COALESCE(j.project_id, d.project_id)` so Weave jobs with `draft_id` null still count.
- `CpOverview.tsx` lists all provider rows on the health card. No new OpsNav item, no `/crm/aco`.

## Tests (TDD)

1. CPA spec written first; failed with `cpa_denominator` undefined.
2. Implemented credit CPA; denom-0 test green.
3. Health + chip specs written next; failed because payload/providers missing.
4. Implemented health grouping + `getProject` counts; suites green.

## Verification

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest --testPathPattern='src/cp/cp-(reports|overview|projects)' --no-coverage
# 4 suites, 63 passed

cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/crm/cp-reports.spec.ts \
  src/lib/crm/cp-ai-ops-panes.util.spec.ts \
  src/lib/crm/cp-project-workspace.util.spec.ts
# 3 files, 21 passed
```

Did **not** exercise the credit tab or PRJ-03 chips in a running browser (no local ops-web session).

## Files

| File | Change |
|---|---|
| `services/ptt-crm-api/src/cp/cp-reports.service.ts` | CPA + by_provider on credit |
| `services/ptt-crm-api/src/cp/cp-reports.service.spec.ts` | denom 0 → null; ratio; by_provider |
| `services/ptt-crm-api/src/cp/cp-overview.service.ts` | per-provider health; project_id join |
| `services/ptt-crm-api/src/cp/cp-overview.service.spec.ts` | weavy/magnific/comfy window |
| `services/ptt-crm-api/src/cp/cp-projects.service.ts` | AI Ops counts on getProject |
| `services/ptt-crm-api/src/cp/cp-projects.service.spec.ts` | 0 → null; real query shape |
| `services/ops-web/src/components/crm/cp/CpReports.tsx` | CPA tile + by_provider table |
| `services/ops-web/src/components/crm/cp/CpProjectWorkspace.tsx` | overview chips |
| `services/ops-web/src/components/crm/cp/CpOverview.tsx` | list health providers |
| `services/ops-web/src/lib/crm/cp-format.ts` + spec | `by_provider` section |
| `services/ops-web/src/lib/crm/cp-project-workspace.util.ts` + spec | `formatAiOpsCount` |
| `services/ops-web/src/lib/crm/cp-api.ts` | project count fields |

Dirty tree left unstaged: `CsdChat*`, `csd-chat-display*`, `globals.css`, `.DS_Store`, `test-results`, untracked docs.

## Self-review

- Prefix stays `/api/crm/cp`. No `/api/v1`. Flags untouched. Task 8 Magnific pane not started.
- Ledger `kind` unchanged; no `kind=provider_magnific`.
- `crm_cp_asset_versions` has no new column.

## Concerns

1. Credit CPA and `getProject` now query `crm_cp_weave_*`. A DB that has not applied the Weave DDL will fail those reads.
2. Approved count is video `final_approved` + Weave `approved`/`final` lanes. The same creative could theoretically appear in both if ingest also created a video version.
3. “Open” Weave WOs include `draft` / `brief_ready` (anything except `cancelled` / `delivered`).
4. When there are approved assets but no charge rows, CPA becomes `0` (`numerator ?? 0`), not `—`. Denominator 0 is still `null`.
5. No live browser pass on credit tab or overview chips.

## Fix pass — Important findings

**HEAD before:** `578b0ec158759c5c9a910c0a28b85d1225b01aa2`  
**Commit:** `fix(cp): count CPA from final_approved only and label AI Ops chips.`  
**Status:** DONE

### Fixes

1. **CPA denominator = video `final_approved` only.** Credit SQL now uses the same `COUNT` as executive `output_final` (`crm_cp_video_versions.approval_status = 'final_approved'`). Weave `lane IN ('approved','final')` is gone. Credit GET does not `SELECT` `crm_cp_weave_*`. No DDL on `crm_cp_asset_versions`.
2. **Chip queries stay different; labels match.** Weave still counts open WO (`status NOT IN ('cancelled','delivered')`). Magnific / Comfy still count `crm_cp_render_jobs`. UI copy is `N WO mở` / `N job Magnific` / `N job Comfy`, or `—` when count is 0/`null`. `aiOpsHref` unchanged.
3. **Weave DDL missing.** `getProject` fail-closes the Weave WO query to `null` (`—`) so a missing `crm_cp_weave_work_orders` table does not 500 the project GET. Magnific / Comfy job counts still load.

### Tests (TDD)

1. CPA SQL-must-not-mention-`crm_cp_weave_` + `approved=2` / charged=10 → `cpa === 5` failed first (weave term still present).
2. Chip label spec failed (`formatAiOpsChipLabel` missing).
3. Fail-closed Weave spec failed (`getProject` rejected on missing table).
4. Implemented; denom-0 → `cpa === null` kept.

### Verification

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest --testPathPattern='src/cp/cp-(reports|overview|projects)' --no-coverage
# 4 suites, 65 passed

cd services/ops-web && ./node_modules/.bin/vitest run \
  src/lib/crm/cp-reports.spec.ts \
  src/lib/crm/cp-project-workspace.util.spec.ts
# 2 files, 20 passed
```

No browser pass (out of scope). Task 8 not started.

### Files

| File | Change |
|---|---|
| `services/ptt-crm-api/src/cp/cp-reports.service.ts` | Drop Weave lanes from CPA denom |
| `services/ptt-crm-api/src/cp/cp-reports.service.spec.ts` | No `crm_cp_weave_`; 10/2 → 5 |
| `services/ptt-crm-api/src/cp/cp-projects.service.ts` | Split Weave query; fail closed |
| `services/ptt-crm-api/src/cp/cp-projects.service.spec.ts` | Missing WO table → `weave_open_count` null |
| `services/ops-web/src/lib/crm/cp-project-workspace.util.ts` + spec | `formatAiOpsChipLabel` |
| `services/ops-web/src/components/crm/cp/CpProjectWorkspace.tsx` | Chip labels |

### Remaining concerns

1. CPA is still `0` when approved > 0 and there are no charges (`numerator ?? 0`). Out of scope.
2. Health “Model allowlist” copy (Minor) not touched.
3. No live browser pass on chips or credit tab.
4. `getProject` still queries `crm_cp_weave_work_orders` when the table exists.
