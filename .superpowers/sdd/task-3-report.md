# Task 3 Report: ops-web rag + `buildCockpitSummary`

## Status

DONE_WITH_CONCERNS

## Summary

ops-web now owns a copied RAG/deadline helper (no Nest import) and a single `buildCockpitSummary` that produces tiles, department bars, attention rows, MoM delta, and insight copy. `StaffKpiGridEntry` gained optional `staff_department` / `updated_at`; `fetchStaffKpi` forwards `team`.

`deriveKpiRag` uses Task 1’s sentinel (`1` vs `2`) so `higherIsBetter === 0` is lower-is-better despite `kpiAchievementPct` treating `higherIsBetter || 1` as higher-is-better. Lower-is-better red fixture is `5.34` (not brief `5.2`, which is yellow at 76.92%).

## TDD Evidence

### RED — Step 1–2: missing modules

Wrote `rag.spec.ts` (copy of Task 1 `kpi.types.spec.ts` groups: no_data, 90/75 cutovers, lower-is-better `5.34`, deadline 2026-09 / Dec wrap, open + closed period) and the brief `cockpit-summary.spec.ts`.

```bash
cd services/ops-web && npx vitest run src/lib/kpi/rag.spec.ts src/lib/kpi/cockpit-summary.spec.ts
```

```
FAIL  src/lib/kpi/cockpit-summary.spec.ts
Error: Cannot find module './cockpit-summary'

FAIL  src/lib/kpi/rag.spec.ts
Error: Cannot find module './rag'

Test Files  2 failed (2)
Tests  no tests
```

Failure reason matches the brief: files/exports missing, not a typo.

### GREEN — Step 3–4: implement + pass

Implemented `rag.ts` (copy of `kpiAchievementPct`, `deriveKpiRag` + sentinel, `kpiUpdateDeadlineIso`, `kpiIsOnTime`; export `KpiRag`), `cockpit-summary.ts` (brief verbatim), and `api.ts` fields/`team` query.

ops-web Vitest does not enable globals. First GREEN run failed with `ReferenceError: describe is not defined`. Added `import { describe, expect, it } from 'vitest'` to both specs (same pattern as other ops-web unit tests), then re-ran.

```bash
cd services/ops-web && npx vitest run src/lib/kpi/rag.spec.ts src/lib/kpi/cockpit-summary.spec.ts
```

```
✓ src/lib/kpi/rag.spec.ts (6 tests) 3ms
✓ src/lib/kpi/cockpit-summary.spec.ts (2 tests) 12ms

Test Files  2 passed (2)
Tests  8 passed (8)
```

- Current tiles: 90 → green, 80 → yellow, 50 → red; `completion_pct` ≈ `(90+80+50)/3`.
- Open period `now=2026-09-20Z` → `ontime_pct === 100`.
- Prev month one green vs current one green → `delta.green === 0`.
- `by_department` names `['Sales', 'Tech']`; first attention row `red`; headline matches `/1 KPI không đạt/`.
- `deptLabel('') === 'Chưa gắn phòng'`; `prevYearMonth(2026, 1) === { year: 2025, month: 12 }`.

## Implementation

`rag.ts` — local copy, not imported from `ptt-crm-api`:

- `kpiAchievementPct`: `Number(higherIsBetter || 1) === 1` (so raw `0` would be treated as higher-is-better).
- `deriveKpiRag`: `hiArg = Number(higherIsBetter ?? 1) === 1 ? 1 : 2` before calling `kpiAchievementPct`.
- Thresholds: `>= 90` green, `>= 75` yellow, else red; null pct → `no_data`.
- Deadline: 5th of next month `16:59:59.999Z`.

`api.ts`:

- `StaffKpiGridEntry.staff_department?: string`
- `StaffKpiGridEntry.updated_at?: string`
- `fetchStaffKpi` params `team?: string` + `if (params?.team) qs.set('team', params.team)`

`cockpit-summary.ts` — brief exports: `deptLabel`, `prevYearMonth`, `filterRowsByDepartment`, `departmentOptions`, types, `buildCockpitSummary`, `rowTrend`.

## Commit

```
ff6d2c5c feat(kpi): compute cockpit summary from staff KPI rows.
```

Files committed (only the five named in the task):

- `services/ops-web/src/lib/kpi/rag.ts`
- `services/ops-web/src/lib/kpi/rag.spec.ts`
- `services/ops-web/src/lib/kpi/cockpit-summary.ts`
- `services/ops-web/src/lib/kpi/cockpit-summary.spec.ts`
- `services/ops-web/src/lib/api.ts`

Did not amend. HEREDOC message from the brief.

## Deviations from Brief

- `rag.spec.ts` copies all six Task 1 cases (not only the three named groups) so 90/75, lower-is-better `5.34`, and 2026-09 deadline stay aligned with API.
- Both specs import Vitest globals; ops-web `vitest.config.ts` has no `globals: true`.
- Lower-is-better red uses `5.34` (parent instruction / Task 1), not brief `5.2`.

## Self-Review

| Area | Assessment |
|------|------------|
| Scope | Only the five brief files |
| Copy vs import | RAG helpers live in ops-web; no Nest package import |
| Sentinel | Same `1` vs `2` workaround as Task 1 `deriveKpiRag` |
| Completion | Mean of `kpiAchievementPct` over scored rows; fixture `(90+80+50)/3` |
| Delta | 1 green current vs 1 green prev → `delta.green === 0` |
| Attention | Red first via `RAG_RANK`; insight headline includes `1 KPI không đạt` |

## Concerns

- `filterRowsByDepartment`, `departmentOptions`, and `rowTrend` are exported for Task 4+ but have no direct unit tests (only `buildCockpitSummary` / `deptLabel` / `prevYearMonth` are asserted).
- `fetchStaffKpi` `team` query is untested at the client (type + `qs.set` only).
- `kpiAchievementPct` still treats `0` as higher-is-better if called directly; only `deriveKpiRag` applies the sentinel. Callers that need lower-is-better RAG must go through `deriveKpiRag`, or pass `2`.
- `completion_pct` averages capped achievement percents (max 100), not raw actual/target ratios.

## Files Changed

```
services/ops-web/src/lib/kpi/rag.ts
services/ops-web/src/lib/kpi/rag.spec.ts
services/ops-web/src/lib/kpi/cockpit-summary.ts
services/ops-web/src/lib/kpi/cockpit-summary.spec.ts
services/ops-web/src/lib/api.ts
```

## Important finding — `metricAchievementPct` sentinel

`kpiAchievementPct` is unchanged (`higherIsBetter || 1`). Added `metricAchievementPct` (`0 → 2`, else `1`) and switched `countsOf`, attention `achievement_pct`, and `rowTrend` to it. Nest `kpi.types.ts` not touched.

Focused test: one lower-is-better row (`higher=0`, `target=4`, `actual=4`) must contribute `100` to `completion_pct`.

### GREEN

```bash
cd services/ops-web && npx vitest run src/lib/kpi/rag.spec.ts src/lib/kpi/cockpit-summary.spec.ts
```

```
✓ src/lib/kpi/rag.spec.ts (6 tests) 2ms
✓ src/lib/kpi/cockpit-summary.spec.ts (3 tests) 11ms

Test Files  2 passed (2)
Tests  9 passed (9)
```
