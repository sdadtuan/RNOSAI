# Task 13 Report: Capacity top 5 (T6) — CEO Lifecycle Tower

**Status:** DONE  
**Branch:** `feat/ceo-lifecycle-tower-t6-t8`  
**Base:** Task 12 commit `cf201164`  
**Spec:** §21 — Năng lực & quá tải

## Summary

Implemented `capacity_top[]` (max 5 overloaded owners) on tower payload and a "Quá tải" UI panel. Counts red/amber exceptions by `owner_staff_id`, applies §21 thresholds, omits ok staff, sorts by `red_owned` desc.

## Backend

### New: `ceo-tower-capacity.util.ts`

- `CapacityRow`, `TowerRosterEntry`, `buildCapacityTop(exceptions, roster)`
- Owner resolution: `owner_staff_id` → `suggest_params.staff_id` / `owner_staff_id`
- Flags: amber if `red≥5` or `red+amber≥10`; red if `red≥8` or `red+amber≥15`

### `ceo-tower-sensor.service.ts`

- Loads roster via `CrmStaffPgRepository.listStaff(500)` (cached in bundle)
- Adds `capacity_top` to payload when non-empty (from org-filtered exception rollup)
- `TowerException.owner_staff_id` from `candidate.ownerId`
- Degraded `{ source: 'capacity' }` when roster load fails

### Types

- `ceo-tower.types.ts`: `TowerCapacityRow`, typed `capacity_top`

## Frontend

### `CeoLifecycleTower.tsx`

- Panel **Quá tải** (`data-testid="ceo-tower-capacity"`) — max 5 rows
- Click name → sets L5 `staff_id=` in URL (toggle off if same)

### `ceo-tower-api.ts`

- Mirrored `TowerCapacityRow` + `owner_staff_id` on `TowerException`

## Tests

| Suite | Result |
|-------|--------|
| `ceo-tower-capacity.util.spec.ts` | PASS — 5 tests |
| `ceo-tower-sensor.service.spec.ts` | PASS — 28 tests (incl. capacity_top integration) |

```bash
cd services/ptt-crm-api && npx jest \
  src/ceo-command/ceo-tower-capacity.util.spec.ts \
  src/ceo-command/ceo-tower-sensor.service.spec.ts --no-coverage
# 33 passed
```

## Concerns

1. **Roster optional** — without `CrmStaffPgRepository` (tests) or on DB failure, names fall back to exception `owner_name`; degraded badge on `capacity` source.
2. **No dedicated cap** — unlike finance strip, capacity always computes when overloaded owners exist; empty → property omitted (T1 test unchanged).
3. **Owner-less S1** — exceptions with `owner_staff_id=null` are excluded from capacity counts (by design §21).
4. **E2E** — no Playwright coverage for capacity panel click → `staff_id=` yet.

## Commit

`feat(ceo-tower): capacity top 5 overloaded owners`

## Files touched

- `services/ptt-crm-api/src/ceo-command/ceo-tower-capacity.util.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-tower-capacity.util.spec.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower-sensor.service.spec.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower.types.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower-finance.util.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower-org.util.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower-org.util.spec.ts`
- `services/ops-web/src/components/crm/ceo/CeoLifecycleTower.tsx`
- `services/ops-web/src/lib/crm/ceo-tower-api.ts`
