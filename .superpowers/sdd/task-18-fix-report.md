# Task 18-FIX Report: Go-live / PATCH / publish races

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `407805e5` — fix(am): persist onboarding drafts before go-live and publish  
**Date:** 2026-09-05

## Summary

Three reviewer Important items are fixed. Dirty onboarding checklist drafts PATCH before go-live. Case PATCH now updates only `status = 'open'` rows and returns 409 `case_closed` when `rowCount === 0`. Dirty template editor drafts PATCH before Xuất bản. Go-live gate codes unchanged. No scorecard.

## Fixes

1. **Go-live vs unsaved checklist** — `AmOnboarding.confirmGoLive` PATCHes dirty item toggles first, then calls go-live. Modal still gates on the draft. `case_closed` maps to the same “Case đã đóng.” copy as `already_closed`.
2. **PATCH after concurrent close** — `patchCase` `UPDATE … AND status = 'open'`. `rowCount === 0` → 409 `case_closed` and no `getCase` / extras load (no successful persist claim). In-memory closed check kept.
3. **Xuất bản last saved row** — `AmSettings.onPublish` PATCHes name/items when the editor is dirty, then publishes.

## TDD evidence

**RED** (test added, production `patchCase` still updated by tenant+id only and ignored `rowCount`):

```
$ cd services/ptt-crm-api && /Users/quoctuan/Documents/CursorAI/RNOSAI/services/ptt-crm-api/node_modules/.bin/jest \
  --config …/feat-am-os/services/ptt-crm-api/jest.config.js \
  --rootDir …/feat-am-os/services/ptt-crm-api \
  src/am/am-onboarding.service.spec.ts --no-coverage
# PATCH rowCount 0: promise resolved instead of 409 case_closed
# 1 failed, 8 passed
```

**GREEN:**

```
$ same command
# 1 suite, 9 passed
```

Required: mocked UPDATE `rowCount 0` → 409 `case_closed`, SQL includes `status = 'open'`, no handover/health extra reads after the failed persist.

## Files

- `services/ptt-crm-api/src/am/am-onboarding.service.ts`
- `services/ptt-crm-api/src/am/am-onboarding.service.spec.ts`
- `services/ops-web/src/components/crm/am/AmOnboarding.tsx`
- `services/ops-web/src/components/crm/am/AmSettings.tsx`

Commit contains only those four files. `.superpowers/` and `node_modules` not staged.

## Concerns

1. **Race test is mocked** — Jest returns `rowCount: 0`; not two real concurrent clients.
2. **No component tests** — PATCH-then-go-live and save-then-publish are untested in ops-web.
3. **Two sequential HTTP calls** — if PATCH succeeds and go-live/publish fails, the draft is already persisted (intended).
4. **Worktree has no local Jest** — ran the main `services/ptt-crm-api` Jest 29.7 binary with explicit `--config` / `--rootDir` on this worktree.
