# Task 10 Report: Settings GET + notify stub + freshness

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `a1688421` — feat(am): add settings read, notifications stub, and work-hours freshness  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/am/am-settings.service.ts` | Reused Task 9 `GET /settings` (no duplicate) |
| `services/ptt-crm-api/src/am/am-freshness.util.ts` + `.spec.ts` | Reused — Tue 09:30 ICT → `Giờ LV còn 8h`; Saturday → `Ngoài giờ LV` |
| `services/ptt-crm-api/src/am/am-notifications.service.ts` | Created — stub list from `crm_am_notifications`; `{ items, unread }` |
| `services/ptt-crm-api/src/am/am-notifications.service.spec.ts` | Created — empty staff; unread from `read_at`; empty stub |
| `services/ptt-crm-api/src/am/am.controller.ts` | Modified — `GET /notifications` `@RequireAmAction('view')` |
| `services/ptt-crm-api/src/am/am.module.ts` | Modified — register `AmNotificationsRepository` + `AmNotificationsService` (class tokens) |
| `services/ops-web/src/lib/crm/am-api.ts` | Modified — `fetchAmNotifications` |
| `services/ops-web/src/lib/crm/am-notify.util.ts` + `.spec.ts` | Created — `showAmNotifyDot(unread)` only when `unread > 0` |
| `services/ops-web/src/components/crm/am/AmShell.tsx` | Modified — freshness chip + bell (empty list OK; **no** hard-coded `5`) |
| `services/ops-web/src/app/crm/account-management/am.css` | Modified — `.am-fresh` / `.am-bell` |

**Not done (out of scope):** mark-read, four event writers, `AmNotifyDrawer` (Task 40). `.superpowers/` not committed.

## TDD evidence

### RED — spec before service

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-notifications.service.spec.ts src/am/am-freshness.util.spec.ts --no-coverage

PASS src/am/am-freshness.util.spec.ts
FAIL src/am/am-notifications.service.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module './am-notifications.service'
```

```
$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-notify.util.spec.ts

FAIL src/lib/crm/am-notify.util.spec.ts
  Error: Cannot find module './am-notify.util'
```

Failure reason matches the brief: module/exports missing, not a typo. Freshness spec already existed and passed.

### GREEN

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest src/am/am-notifications.service.spec.ts src/am/am-freshness.util.spec.ts --no-coverage

PASS src/am/am-freshness.util.spec.ts
PASS src/am/am-notifications.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
```

```
$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-notify.util.spec.ts

✓ src/lib/crm/am-notify.util.spec.ts (2 tests)
```

Brief assertions: Tuesday 09:30 ICT (`2026-09-01T02:30:00.000Z`) → `Giờ LV còn 8h`; Saturday → `Ngoài giờ LV`; notify `{ items, unread }` with unread counted from `read_at IS NULL` (never hard-coded `5`); bell dot only when `unread > 0`.

## Behavior

- `GET /api/crm/am/settings` — cap `view`. Reused Task 9 `AmSettingsService.get()`.
- `GET /api/crm/am/notifications` — cap `view`. Returns `{ items, unread }`. Missing staff or missing table → `{ items: [], unread: 0 }`.
- Unread = count of listed items with `read_at` null. Dot in AmShell via `showAmNotifyDot(unread)` only.
- Freshness chip in AmShell topbar from `command-center.freshness.work_left_label` (already computed in dashboard). Stale → warn style.
- Repositories injected as **class** tokens (`AmNotificationsRepository`), not type-only interfaces.

## Concerns

- Notify list is a read stub — no mark-read, no writers (`sla.breached` / `renewal.ending` / `health.drop` / `invoice.paid`) this wave.
- Empty list is the Wave 1 default; bell never shows a hard-coded count.
- Palette/bell not exercised in a logged-in browser this task (staff auth required).
- Settings GET landed in Task 9; this task only reused it.
