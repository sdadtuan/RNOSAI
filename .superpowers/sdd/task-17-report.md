# Task 17 Report: Asset rights + bind gate

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e1`  
**Worktree:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-cmkte-e1`  
**Commit:** `feat(cmkte): asset rights block publish gate`  
**Status:** DONE_WITH_CONCERNS

## What was implemented

| Surface | Behavior |
|---|---|
| `evaluateItemRights` + `selectedMediaAssetRefs` | Required assets = selected `media_json` URLs ∪ existing rights `asset_ref`. Missing row = Unknown. Unknown/Invalid → `rightsValid=false`. Expiring is not Invalid; `paid_ok` + Expiring → `paidExpiryWarning`. No selected assets and no rows → omit `rightsValid`. |
| `GET/PUT …/items/:itemId/rights` | Lifecycle prefix. PUT replaces all rows for the item. Write guard on PUT. |
| `POST …/items/:itemId/rights/:rightsId/override` | `StaffContentMarketingQaGuard` (`crm_board.view` + `crm_content.qa` only — not approve_internal). `reason` trim ≥ 10 + non-empty `evidence`. Sets status Valid + `insertItemVersion(..., 'rights_override')`. No COS UI. |
| `publishItem` | Calls `evaluatePublishGate`. Blocked → `ConflictException({ error: 'publish_gate_blocked', blockers })`. Derives `briefReady` from score/threshold, `internalApproved` from status, `clientApproved` from client-gate/status, `urlOk` from provided `published_url`. Passes `legalRequired: false` (no legal source). Omits alt/version/account flags. |
| `StaffContentMarketingQaGuard` | New. Approve guard is **not** used for override. |

Did **not** change `evaluatePublishGate` / FE mirror. Did **not** implement Task 18 packages, Task 19 matrix, or Task 20 collision. Did not seed clients, enable `CP_AI_ENABLED`, or touch Video SOP / Creative OS / `QC_CHECK_KEYS`.

## TDD evidence

### RED

Tests written first. First Jest run (implementation missing):

```
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/content-os-portfolio \
  src/content-marketing/content-item.service.spec.ts \
  src/content-marketing/content-marketing.controller.spec.ts \
  --no-coverage
```

| Spec | Failure (expected) |
|---|---|
| `asset-rights.service.spec.ts` | `TS2307: Cannot find module './asset-rights.service'` |
| `content-marketing.controller.spec.ts` | `TS2554` extra ctor arg; `listItemRights` / `replaceItemRights` / `overrideItemRight` missing |
| `content-item.service.spec.ts` | `publishItem` did not throw `ConflictException` (proceeded to patch → `TypeError` on `updated.body_json`) |

```
Test Suites: 3 failed, 6 passed, 9 total
Tests:       1 failed, 57 passed, 58 total
```

### GREEN

Same covering command after implementation:

```
Test Suites: 9 passed, 9 total
Tests:       89 passed, 89 total
Time:        17.044 s
```

Required case: `rightsValid=false` → `publish_gate_blocked` with `rights_invalid` — pass.

## Self-review

- Gate rule function unchanged; optional flags still do not block when omitted.
- Empty items (no media, no rights rows) still omit `rightsValid` so human-publish remains possible.
- Override is QA-only + reason/evidence + version audit. No normal UI.
- Constructor of `ContentMarketingController` gained `AssetRightsService` as last arg; only the matching spec constructs it.
- `listAssetRights` is called on every `publishItem`. If Postgres has `cmkt_content_items` but the E DDL (`cmkt_asset_rights`) is not applied, publish will throw a SQL error instead of a gate 409.

## Concerns

- `cmkt_asset_rights` must exist in the target DB (DDL in `docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql`). `ensurePgReady` only probes `cmkt_content_items`.
- Jest worker “failed to exit gracefully” warning is pre-existing in this suite (open handles), not introduced by rights.
- No browser/UI verification — E1 override has no COS UI (BR-056).
- `legalRequired` is passed `false` (required input on the gate type) rather than omitted; other E1 flags stay omitted.

## Files

- `services/ptt-crm-api/src/content-os-portfolio/asset-rights.service.ts` + `.spec.ts`
- `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.types.ts`
- `services/ptt-crm-api/src/content-marketing/content-item.service.ts` + `.spec.ts`
- `services/ptt-crm-api/src/content-marketing/content-marketing.controller.ts` + `.spec.ts`
- `services/ptt-crm-api/src/content-marketing/content-marketing.module.ts`
- `services/ptt-crm-api/src/content-marketing/content-marketing.repository.ts`
- `services/ptt-crm-api/src/content-marketing/guards/staff-content-marketing.guard.ts`
