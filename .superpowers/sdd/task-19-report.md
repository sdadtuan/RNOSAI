# Task 19 Report: Matrix — một rule Legal

**Date:** 2026-09-11  
**Branch:** `feat/cmkte-e1`  
**Worktree:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-cmkte-e1`  
**Commit:** (this change) — `feat(cmkte): dynamic matrix legal step and paid rights blocker`  
**Status:** DONE

## What was implemented

| Surface | Behavior |
|---|---|
| `applyApprovalMatrix` | Verbatim from brief. Always `owner` → (`content_lead` if Brand-Sensitive/Regulated) → (`legal` if Financial/Health/Legal) → `account_director` → `client`. `paidIntent && !paidOk` → `gateBlockers: ['Paid media rights invalid']`. `marketCount` accepted, unused (E1). |
| Claim detector E1 | Scan `brief_json.restricted` (string or string[]) **and** body markdown/html/variants. `DEFAULT_CLAIM_LEXEMES = ['cam kết sinh lời','giá rẻ','số 1']` (case-insensitive). Any hit → `claimCategories` includes `'Legal'`. No COS settings reader / no admin UI. |
| GET item / submit-review | Attach `approval_matrix` + `claim_hits`. Portfolio GET uses lifecycle `getItem` (hint + fallback). |
| `publishItem` | Does **not** change `evaluatePublishGate`. If already Blocked and matrix has `gateBlockers`, pass them as extra 409 context. Does not set `rightsValid=false` from paid. |
| Copy tab | List of hits + wrap matched lexemes in `<mark class="cmkte-claim">`. No new screen. |

Did **not** implement Task 20 collision or Task 21 portal strip. Did not invent Health/Financial taxonomies or a settings admin UI.

## TDD evidence

### RED

Tests written first. First Jest run (implementation missing):

```
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/content-os-portfolio/approval-matrix.util.spec.ts --no-coverage
```

`TS2307: Cannot find module './approval-matrix.util'`

Service specs then failed on missing `approval_matrix` / fallback not re-entering `getItem`.

### GREEN

Covering command:

```
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/content-os-portfolio/approval-matrix.util.spec.ts --no-coverage
```

Plus service specs:

```
Test Suites: 4 passed, 4 total
Tests:       61 passed, 61 total
```

Full `src/content-os-portfolio`: 8 suites / 74 tests passed.

FE: `vitest run src/lib/crm/cmkte-workspace.spec.ts` — 7 passed (lexeme list + wrap segments).

## Self-review

- Matrix function body matches the brief verbatim.
- Legal is the only claim category invented (lexeme hit → `'Legal'`).
- Paid blocker lives on the matrix payload / 409 extra context; Task 17 still owns Invalid rights via `evaluatePublishGate`.
- GET item now reads `listAssetRights` so paidIntent/paidOk can be derived.

## Concerns

- `listAssetRights` on every GET item / submit-review. If `cmkt_asset_rights` is missing, GET item will SQL-error (same class of risk as Task 17 publish).
- `marketCount` is computed and passed but the verbatim matrix does not add a Local Market Lead step.
- Copy highlight is client-side + API `claim_hits`; no browser UAT in this task.
- Jest worker “failed to exit gracefully” is pre-existing in this suite.

## Files

- Create: `services/ptt-crm-api/src/content-os-portfolio/approval-matrix.util.ts` + `.spec.ts`
- Modify: `content-item.service.ts` + spec (`getItem`, `publishItem`)
- Modify: `content-workflow.service.ts` + spec (`submitReview`)
- Modify: `content-os-portfolio.service.ts` + spec (portfolio GET via `getItem`)
- Modify: `content-marketing.types.ts`
- Modify: `services/ops-web` Copy tab + `cmkte-workspace` helpers/spec + `content-os-api` types + `cmkte.css`
