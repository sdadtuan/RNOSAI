# Task 10 Report — org_rollup + breadcrumb 5 lớp (T4)

**Branch:** `feat/ceo-lifecycle-tower-t3-t5`  
**Date:** 2026-09-01  
**Spec:** §16.4, §18 — CEO Lifecycle Tower design

## Summary

Implemented 5-layer org rollup (company → 6 departments → team → position → staff) and wired CEO tower UI breadcrumb + department panel with URL-synced filters.

## Backend

### New: `ceo-tower-org.util.ts`

- `TOWER_DEPT_CATALOG` — 6 departments (HR/IT `outside_cycle: true`)
- `resolveExceptionDepartment()` — prefers `department_code`, else sensor→dept map per §16.4 (S11 → null)
- `buildOrgRollup()` — company PTT row + mandatory 6 department rows + dynamic team/position/staff rows; HR/IT counts forced to 0
- `exceptionMatchesOrgFilters()` — post-classification filter using resolved department + team/position/staff_id

### Modified: `ceo-tower-sensor.service.ts`

- Replaced stub `org_rollup` with `buildOrgRollup(rollupSource)` from classified rows (same base set as column counts, before severity/window/pagination)
- Org filters (`department`, `team`, `position_code`, `staff_id`) applied in `buildPayload` via `exceptionMatchesOrgFilters` (department uses sensor fallback)

## Frontend

### Modified: `CeoLifecycleTower.tsx`

- Breadcrumb: Công ty › [A|B factory if filtered] › phòng › team › chức vụ › người; **×** clears org filters
- “Theo phòng” panel from `org_rollup` department entries; click sets `?department=DEPT-*`
- HR/IT empty copy: `Không theo dõi trên tháp — mở /crm/staff hoặc /admin`
- Query passes `department`, `team`, `position_code`, `staff_id` to `fetchCeoTower`

### Modified: `ceo-tower-ui.util.ts`

- `buildTowerBreadcrumb`, `departmentRollupEntries`, `deptRollupSummary`, `isOutsideCycleDepartment`, `TOWER_OUTSIDE_CYCLE_COPY`

## Tests

| Suite | Result |
|-------|--------|
| `ceo-tower-org.util.spec.ts` | PASS — sensor→dept map, 6 dept invariant, HR/IT zero counts, team/position/staff rollup |
| `ceo-tower-sensor.service.spec.ts` | PASS — company + 6 departments in payload |
| `ceo-tower-ui.util.spec.ts` | PASS — breadcrumb + outside-cycle copy |
| `ceo-lifecycle-tower.spec.ts` (e2e) | Added T4 — Sales dept click, TEAM-SALES-AM filter, HR outside-cycle empty (not run in CI this session) |

### Commands run

```bash
cd services/ptt-crm-api && npx jest src/ceo-command/ceo-tower-org.util.spec.ts src/ceo-command/ceo-tower-sensor.service.spec.ts --no-coverage
# 44 passed

cd services/ops-web && npx vitest run src/lib/crm/ceo-tower-ui.util.spec.ts
# 7 passed
```

## Concerns / follow-ups

1. **S1 factory B / CSKH source** — spec notes S1 may map to CSKH for board-sourced leads; current map always uses DEPT-SALES per task brief.
2. **Team/position/staff breadcrumb clicks** — panel exposes department clicks; deeper levels filter via URL but no dedicated click targets on team/staff rollup rows yet (L4/L5 via future panel or queue row click).
3. **Cache key** — org filter params still in cache key though filtering now happens in `buildPayload`; could dedupe cache entries in a later perf pass.
4. **E2e** — T4 test uses mocked API with query-param filtering; full stack integration depends on roster data populating `department_code` on exceptions.

## Files touched

- `services/ptt-crm-api/src/ceo-command/ceo-tower-org.util.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-tower-org.util.spec.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.spec.ts`
- `services/ops-web/src/components/crm/ceo/CeoLifecycleTower.tsx`
- `services/ops-web/src/lib/crm/ceo-tower-ui.util.ts`
- `services/ops-web/src/lib/crm/ceo-tower-ui.util.spec.ts`
- `services/ops-web/e2e/ceo-lifecycle-tower.spec.ts`
