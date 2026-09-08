# Task 17 report — Convert UI (CVT-01)

**Status:** DONE  
**Branch:** `feat/quotation-os`  
**Commit:** `feat(qt): convert panel`

## What shipped

- `QtConvert` on `/crm/proposals/[id]/convert` — accepted version (`quote_code` + `current_version_id`), planned lifecycles from lines or last convert payload, AC-08 note “Convert lần 2 không nhân bản.”
- **Chạy convert** → `POST /api/crm/proposals/:id/versions/:vid/convert` with reused `Idempotency-Key`. Second click shows the same `conversion_id` / lifecycle / invoice ids (no invented second set).
- Button disabled when `status !== accepted` (or missing version). API `quote_not_accepted` is shown as-is.
- `optional_handoff` always empty — UI does not claim CP / CSD created.

Vietnamese. `qt-*` classes. `dash(null)` = `—`. No extra `<main>`. No NOVA / Wave copy.

## TDD

### RED

Wrote `QtConvert.spec.ts` first. First run: `Cannot find module './QtConvert'` — feature file missing.

### GREEN

```
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/components/crm/qt src/lib/crm/qt-format.spec.ts \
  src/lib/crm/qt-nav.util.spec.ts
```

**61 passed / 14 files** (5 new in QtConvert.spec.ts).

| Spec | Result |
|---|---|
| Convert button disabled when status ≠ accepted | pass |
| Accepted version + planned DV codes + AC-08 note; no CP/CSD claim | pass |
| API `quote_not_accepted` rendered | pass |
| Last convert payload reused (no second invented lifecycle set) | pass |
| Second `convertQtVersion` (mock fetch) returns same ids + Idempotency-Key | pass |

## Concerns

- Browser click-through not run (no live ops-web session / accepted quote in this subagent).
- Planned rows before convert have `lifecycle_id = —` until Task 10 returns ids.
- Convert page is not linked from builder chrome in this task (route exists; nav is still list/new).
- Same session `Idempotency-Key` is reused; a full page reload generates a new key (API still replays by `version_id` + `target_type`).

## Files

- `services/ops-web/src/components/crm/qt/QtConvert.tsx` + `.spec.ts`
- `services/ops-web/src/app/crm/proposals/[id]/convert/page.tsx`
- `services/ops-web/src/lib/crm/qt-api.ts`
