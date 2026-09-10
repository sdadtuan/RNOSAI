# Task 18 Report: Approval package lock

**Date:** 2026-09-11  
**Branch:** `feat/cmkte-e1`  
**Worktree:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-cmkte-e1`  
**Commit:** (this change) — `feat(cmkte): immutable approval package on submit`  
**Status:** DONE

## What was implemented

| Surface | Behavior |
|---|---|
| `ApprovalPackageService.createSentOnSubmit` | After brief + body gates, `submitReview` inserts `cmkt_approval_packages` with `status='Sent'` and `snapshot_json={ body_json, brief_json, media, rights, disclaimer }`. Media from `media_json`, rights from `listAssetRights`, disclaimer from `brief_json.disclaimer`. |
| `patchItem` body / `apply_variant` | Latest package `Sent` → `ConflictException({ error: 'package_locked' })`. `brief_locked` unchanged. |
| `force_version === true` | Allows the body patch, `insertItemVersion(..., 'package_force_version')`, latest Sent → `Superseded`. |
| Title / assignee | Not package-locked. |
| Reject comment ≥ 10 | Unchanged (existing `assertRejectComment`). |

Did **not** implement Task 19 matrix, Task 20 collision, or Task 21 portal strip. Did not seed clients, enable `CP_AI_ENABLED`, or touch Video SOP / Creative OS / `QC_CHECK_KEYS`.

## TDD evidence

### RED

Tests written first. First Jest run (implementation missing):

```
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/content-marketing/approval-package.service.spec.ts \
  src/content-marketing/content-workflow.service.spec.ts \
  src/content-marketing/content-item.service.spec.ts \
  --no-coverage
```

| Spec | Failure (expected) |
|---|---|
| `approval-package.service.spec.ts` | `TS2307: Cannot find module './approval-package.service'` |
| `content-workflow.service.spec.ts` | Same missing module; `TS2554` Expected 4 arguments, but got 5 |
| `content-item.service.spec.ts` | Same missing module; `TS2554` Expected 3 arguments, but got 4 |

```
Test Suites: 3 failed, 3 total
Tests:       0 total
```

### GREEN

Same covering command after implementation (plus `content-idea.service.spec.ts` for the extra ctor arg):

```
Test Suites: 4 passed, 4 total
Tests:       36 passed, 36 total
Time:        9.641 s
```

Required cases: submit inserts Sent snapshot; body/`apply_variant` → `package_locked`; `force_version` audits + supersedes; title/assignee unlocked — pass.

## Self-review

- Snapshot is built from the pre-patch item after gates succeed, so body/brief/media match what was submitted.
- Package lock is only on body / apply_variant. Brief lock stays a separate 409.
- `force_version === true` is a strict boolean (same as brief lock).
- Repo has PG + memory helpers; unit tests stub those methods on the existing workflow/item mocks.

## Concerns

- `cmkt_approval_packages` must exist in the target DB (DDL in `docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql`). `ensurePgReady` only probes `cmkt_content_items`.
- Older Sent rows are left in place when only the latest Sent is superseded.
- Jest worker “failed to exit gracefully” warning is pre-existing in this suite.
- No HTTP-level 409 integration test (service exceptions are unit-tested).

## Files

- Create: `services/ptt-crm-api/src/content-marketing/approval-package.service.ts` + `.spec.ts`
- Modify: `content-workflow.service.ts` + spec
- Modify: `content-item.service.ts` + spec
- Modify: `content-idea.service.spec.ts` (ctor stub)
- Modify: `content-marketing.repository.ts` (insert / latest / status + memory)
- Modify: `content-marketing.types.ts`
- Modify: `content-marketing.module.ts`
