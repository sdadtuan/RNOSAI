# Task 9 Report: Briefing Hôm nay dùng chung sensor (T3)

**Branch:** `feat/ceo-lifecycle-tower-t3-t5`  
**Date:** 2026-09-01  
**Commit:** `feat(ceo-tower): briefing today shares tower sensors`

## Summary

Wired `briefing_today` to reuse `CeoTowerSensorService.buildPayload` so Hôm nay cards match the Lifecycle Tower red exceptions. Tower red cards are prepended before ops/pipeline sources and capped at 8 total.

## Changes

### `ceo-command-briefing.service.ts`
- Injected `CeoTowerSensorService` (already exported from `ceo-command.module.ts`).
- For `compose('briefing_today')` only: calls `tower.buildPayload(actor, { factory: 'both', severity: 'red,amber', limit: '8' })`.
- Maps red exceptions → briefing cards (`source: 'tower'`, `severity: 'red'`, `title`, `href`, `suggest_action`).
- Merges `payload.degraded` into briefing `degraded`; on failure pushes `{ source: 'tower', reason }`.
- Updated `compose` actor type to `CeoActor` (matches tower API and caller).

### `ceo-command-briefing.util.ts`
- Added `'tower'` to `CeoBriefingCard.source` union.
- Extended `suggest_action` with tower action ids (`assign_lead`, `remind_staff`, `sla_remind_lead`, `ack_ops_alert`, `prioritize_solution_queue`, `remind_contract_approval`).
- `cardsFromSources` accepts optional `towerRed`; prepends tower red cards before sorted other sources; trims to max 8.
- Records `facts_json.tower_red` when tower input present.

### Tests
- **`ceo-command-briefing.util.spec.ts`**: invariant (tower card hrefs ⊆ red exception hrefs); priority (5 tower + 6 ops + 4 pipeline → 8 cards, tower first).
- **`ceo-command-briefing.service.spec.ts`** (new): tower query args, red-only cards, degraded merge on failure/payload, no tower call for `briefing_ops`.

## Test run

```bash
cd services/ptt-crm-api && npx jest \
  src/ceo-command/ceo-command-briefing.util.spec.ts \
  src/ceo-command/ceo-command-briefing.service.spec.ts \
  src/ceo-command/ceo-command.service.spec.ts \
  --no-coverage
```

**Result:** 3 suites, 10 tests, all passed.

## Notes / follow-ups

- Amber tower exceptions are fetched (shared query) but not surfaced as cards — only red per spec.
- Briefing cache (60s per `staffId:intent`) is independent of tower cache; both use 60s TTL.
- No new KPIs invented; tower cards mirror exception titles/hrefs/actions only.
