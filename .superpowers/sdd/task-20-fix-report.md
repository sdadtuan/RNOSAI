# Task 20-FIX Report: Lost lessons vs recoverable tag

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `7d110b57` — fix(am): require real lessons on lost renewals  
**Date:** 2026-09-05

## Summary

Lost PATCH now requires trimmed **user** lessons (body or stored, before any `[recoverable]` / `[not_recoverable]` prefix). A recoverable flag alone is not enough. Ordinary PATCH that omits `recoverable` persists `current.lessons` unchanged, so Lưu no longer strips the tag. Gate codes unchanged. No DDL.

## Fixes

1. **Lost + recoverable with empty lessons** — `userLessons = stripRecoverablePrefix(rawLessons)`. `status=lost` checks that string, not `nextLessons`. Empty → 400 `lost_fields_required`, no UPDATE. `applyRecoverable('', true)` can no longer satisfy the gate as `[recoverable]`.
2. **Ordinary PATCH keeps the tag** — when `recoverable` is omitted, persist `trimOrNull(rawLessons)` (stored or body text as-is). `applyRecoverable` runs only when the flag is sent.

## TDD evidence

**RED** (tests added, production still applied `applyRecoverable` before the lost check and peeled the prefix when `recoverable` was omitted):

```
$ /Users/quoctuan/Documents/CursorAI/RNOSAI/services/ptt-crm-api/node_modules/.bin/jest \
  --config …/feat-am-os/services/ptt-crm-api/jest.config.js \
  --rootDir …/feat-am-os/services/ptt-crm-api \
  src/am/am-renewals.service.spec.ts --no-coverage
# lost + recoverable, no lessons: expected 400 lost_fields_required, got 409 case_closed
# forecast-only PATCH: UPDATE lessons was "budget cut" (prefix stripped)
# 2 failed, 4 passed
```

**GREEN:**

```
$ same command
# 1 suite, 6 passed
```

Required: PATCH lost with reason + date + `recoverable: true` and no lessons → 400, no UPDATE. Existing `[recoverable] budget cut` + PATCH forecast only → UPDATE lessons still contain `[recoverable]`.

## Files

- `services/ptt-crm-api/src/am/am-renewals.service.ts`
- `services/ptt-crm-api/src/am/am-renewals.service.spec.ts`

Commit contains only those two files. `.superpowers/` and `node_modules` not staged.

## Concerns

1. **Tests are mocked** — Jest drives `db.query`; not a real Postgres UPDATE.
2. **Worktree has no local Jest** — ran the main `services/ptt-crm-api` Jest binary with explicit `--config` / `--rootDir` on this worktree.
3. **ops-web `amRenewalLostError` unchanged** — still a client-side lessons check; not in this brief.

DONE_WITH_CONCERNS
