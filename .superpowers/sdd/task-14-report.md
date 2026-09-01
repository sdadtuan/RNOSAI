# Task 14 Report: Board pack 1 trang (T7) — CEO Lifecycle Tower

**Status:** DONE  
**Branch:** `feat/ceo-lifecycle-tower-t6-t8`  
**Base:** Task 13 commit `f8045f12`  
**Spec:** §22 — Board pack tuần (1 trang)

## Summary

Implemented weekly one-page board pack: backend `GET /api/crm/ceo/tower/board-pack?week=YYYY-Www` returns `facts_json` with every number on the print page; frontend `/crm/ceo/board-pack` renders facts with A4 print CSS and browser print button.

## Backend

### New: `ceo-tower-board-pack.util.ts`

- `resolveBoardPackWeek(week?, now?)` — ISO week ICT default `YYYY-Www`
- `buildBoardPackFacts(payload, weekLabel)` — facts_json with:
  - K1–K4 + status (`k_strip`)
  - red/amber counts per 6 columns + 6 departments
  - top 10 exceptions (from tower payload limit=10)
  - finance 5 cells (when `finance_strip` present)
  - `capacity_top`
  - `s11_fail` / `s12_fail`
  - `degraded[]`
  - `decisions_blank: ['','','']`
- `isBoardPackNotifyEnabled()` — reads `PTT_CEO_BOARD_PACK_NOTIFY` (default 0); no cron

### `ceo-command.controller.ts`

- `GET tower/board-pack?week=YYYY-Www`
- Cap = tower view (`StaffCeoCommandViewGuard`)
- Reuses `CeoTowerSensorService.buildPayload` with `{ factory: 'both', severity: 'red,amber', limit: '10' }`
- Returns `{ ok: true, week, facts_json, generated_at }`

## Frontend

### New: `services/ops-web/src/app/crm/ceo/board-pack/page.tsx`

- Auth pattern matches `/crm/ceo`
- Fetches board-pack API via `fetchCeoTowerBoardPack`
- Print CSS A4 (`@page size: A4`)
- Button **In / PDF trình duyệt** → `window.print()`
- Renders all sections from `facts_json` only (no invented numbers)

### `CeoLifecycleTower.tsx`

- Link **In tuần** → `/crm/ceo/board-pack`

### `ceo-tower-api.ts`

- `fetchCeoTowerBoardPack(token, week?)` + `TowerBoardPackResponse` type

## Tests

| Suite | Result |
|-------|--------|
| `ceo-tower-board-pack.util.spec.ts` | PASS — 4 tests (required keys, top-10 cap, finance optional, ICT week) |
| `ceo-tower.controller.spec.ts` | PASS — 4 tests (incl. board-pack route) |

```bash
cd services/ptt-crm-api && npx jest \
  src/ceo-command/ceo-tower-board-pack.util.spec.ts \
  src/ceo-command/ceo-tower.controller.spec.ts --no-coverage
# 8 passed
```

## Concerns

1. **Week query is label-only** — `week=YYYY-Www` labels the pack; tower data is current snapshot (not historical week replay). Matches T7 scope.
2. **No cron/notify** — `PTT_CEO_BOARD_PACK_NOTIFY=1` is read but no Monday 08:00 staff_notifications hook yet.
3. **E2E** — no Playwright test for print page; optional note in spec file only.
4. **Print CSS selectors** — `.staff-shell-sidebar` / `.staff-shell-topbar` may need tuning if shell class names differ in prod.

## Commit

`feat(ceo-tower): weekly board pack print page`

## Files touched

- `services/ptt-crm-api/src/ceo-command/ceo-tower-board-pack.util.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-tower-board-pack.util.spec.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-command.controller.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-tower.controller.spec.ts`
- `services/ops-web/src/lib/crm/ceo-tower-api.ts`
- `services/ops-web/src/app/crm/ceo/board-pack/page.tsx` (new)
- `services/ops-web/src/components/crm/ceo/CeoLifecycleTower.tsx`
