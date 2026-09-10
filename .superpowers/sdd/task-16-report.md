# Task 16 Report: Master / deliverable graph on cmkt items

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e1`  
**Worktree:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-cmkte-e1`  
**Commit:** `aa9528c1` — `feat(cmkte): master and deliverable graph on cmkt items`  
**Status:** DONE_WITH_CONCERNS

## What was implemented

| Surface | Behavior |
|---|---|
| `createItem` + `body.as_master === true` | Persists `master_id = null` and mints one CNT via `formatContentItemCode` + marketing `nextItemSeq` (same `CNT-YYYYMMDD-NNN` as portfolio). Without `as_master`, no CNT is minted. |
| Convert request | Passes `as_master: true` into `createItem` (one master). Links `request_id` only — does **not** mint a second CNT. |
| `updateItemRequestLink` | `display_code` optional; omitted/empty updates `request_id` only and returns the existing code. |
| Repurpose / `createDerivedItem` | Child `master_id = source.master_id ?? source.id` (child-of-child still roots at the master). |
| `POST items/:itemId/promote-master` | Write guard. Sets this item’s `master_id = null` only (spec 5.2 standalone). Does not rewrite the graph. |
| `GET items/:itemId/deliverables` | Lifecycle prefix. Returns items in the same lifecycle whose `id === current` or `master_id === current` (includes self). |
| `CmktItemRow` / `mapItemRow` / FE `ContentOsItem` | Optional `master_id`, `display_code`. |
| FE Architecture tab | Table: Mã / Title / Format · Channel. Empty list → `Chưa có deliverable trong lifecycle này.` Empty cells → `dash()` (`—`). No seeded clients. |

Did **not** implement rights / publish gate (Task 17) or packages (Task 18). Did not seed clients, enable `CP_AI_ENABLED`, or touch Video SOP / Creative OS / `QC_CHECK_KEYS`.

Worktree already had Task 16 tests + implementation half-edited. Finished and verified those files; did not start over.

## TDD evidence

### RED

New specs already present in the worktree. Confirmed they fail against Task 15 HEAD (`096c6220`) production files (tests kept, impl checked out):

```
cd services/ptt-crm-api && npx jest \
  src/content-marketing/content-item.service.spec.ts \
  src/content-marketing/content-repurpose.service.spec.ts \
  src/content-os-portfolio/content-os-portfolio.service.request.spec.ts \
  src/content-marketing/content-marketing.controller.spec.ts \
  --no-coverage
```

| Spec | Failure (expected) |
|---|---|
| `content-item.service.spec.ts` | `TS2339: Property 'promoteMaster' does not exist`; `listDeliverables` missing |
| `content-marketing.controller.spec.ts` | `TS2339: Property 'promoteMaster' / 'listDeliverables' does not exist` |
| `content-os-portfolio.service.request.spec.ts` | Suite failed to compile: HEAD convert required `display_code: string` after types made it optional |
| `content-repurpose.service.spec.ts` | `createDerivedItem` received `parent_item_id` only — missing `master_id` 10 (master) and 10 (child-of-child) |

```
Test Suites: 4 failed, 4 total
Tests:       2 failed, 2 total
```

(Three suites failed at compile; repurpose ran and failed on assertions.)

FE filter spec is new (`cmkte-deliverables.spec.ts`); no prior module on HEAD.

### GREEN

Restored Task 16 implementation. Same covering commands:

**Jest:**

```
cd services/ptt-crm-api && npx jest \
  src/content-marketing/content-item.service.spec.ts \
  src/content-marketing/content-repurpose.service.spec.ts \
  src/content-os-portfolio/content-os-portfolio.service.request.spec.ts \
  src/content-marketing/content-marketing.controller.spec.ts \
  --no-coverage
```

```
Test Suites: 4 passed, 4 total
Tests:       35 passed, 35 total
Time:        8.692 s
```

**Vitest:**

```
cd services/ops-web && npm run test:unit -- src/components/content-os/cmkte
```

```
Test Files  1 passed (1)
Tests       4 passed (4)
```

Re-run immediately before commit: **35 Jest + 4 Vitest passed**.

Convert assertion: `createItem` called once with `as_master: true`; `nextItemSeq` not called on portfolio repo; `updateItemRequestLink(55, { request_id: 9 })` only; `master_id` null; one `CNT-…-021`.

## Files

- Create: `services/ptt-crm-api/src/content-marketing/content-repurpose.service.spec.ts`
- Create: `services/ops-web/src/components/content-os/cmkte/cmkte-deliverables.ts`
- Create: `services/ops-web/src/components/content-os/cmkte/cmkte-deliverables.spec.ts`
- Modify: `services/ptt-crm-api/src/content-marketing/content-item.service.ts` (+ spec)
- Modify: `services/ptt-crm-api/src/content-marketing/content-marketing.controller.ts` (+ spec)
- Modify: `services/ptt-crm-api/src/content-marketing/content-marketing.repository.ts` (`mapItemRow`, `nextItemSeq`, `createItem`, `createDerivedItem`)
- Modify: `services/ptt-crm-api/src/content-marketing/content-marketing.types.ts`
- Modify: `services/ptt-crm-api/src/content-marketing/content-repurpose.service.ts`
- Modify: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts` (+ request spec)
- Modify: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts`
- Modify: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.types.ts`
- Modify: `services/ops-web/src/lib/content-os-api.ts`
- Modify: `services/ops-web/src/lib/crm/use-cmkt-item.ts`
- Modify: `services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx`

## Self-review

- Convert produces **one** master: `as_master: true` on the single `createItem`; CNT comes from `createItem`, not a second `formatContentItemCode` in convert.
- CNT format is the existing helper (`CNT-` + `ymd` + 3-digit seq). Marketing `nextItemSeq` and portfolio `nextItemSeq` / `nextDisplaySeq` call one shared `nextDisplaySeq` query (no second MAX+1).
- Repurpose roots at `source.master_id ?? source.id`.
- Promote is write-guarded and only nulls this row’s `master_id`.
- Deliverables API + FE filter both use `id === current || master_id === current` (include self). Viewing a child shows only that child, per resolved spec — not the full family.
- Architecture empty state is copy + `—`, no client seed.
- `mapItemRow` now reads `master_id` / `display_code`. Memory `createItem` / `createDerivedItem` persist those fields when provided.

## Concerns

- ~~Marketing repo now has its own `nextItemSeq` alongside portfolio’s. Same SQL shape, but two helpers can drift.~~ **Fixed** — see Review fix below.
- Controller specs assert delegation only, not `StaffContentMarketingWriteGuard` metadata on `promote-master`.
- Architecture tab still fetches pillars/derivations (unused). Viewing a child does not list siblings / the master (matches the written filter, may surprise operators).
- In-memory derived items do not mint a `display_code` (not required). Promote does not assign a CNT if the row lacked one.

## Review fix (Important): reuse portfolio CNT seq

**Finding:** Marketing `nextItemSeq` cloned portfolio `nextDisplaySeq`. Same SQL, two helpers — they can drift. Task resolution required the existing seq helper.

**Fix:** Extracted the existing MAX+1 query into `services/ptt-crm-api/src/content-os-portfolio/display-seq.ts` (`nextDisplaySeq`). `ContentOsPortfolioRepository.nextDisplaySeq` / `nextItemSeq` and marketing `nextItemSeq` both call that helper. Did not inject `ContentOsPortfolioService` (circular: it already uses `ContentItemService`). `ContentOsPortfolioModule` does not export the repository, so no Nest repo inject.

**Tests (required):**

- `src/content-marketing/content-item.service.spec.ts`
- `src/content-os-portfolio/content-os-portfolio.service.request.spec.ts`

```
cd /Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-cmkte-e1/services/ptt-crm-api && npx jest src/content-marketing/content-item.service.spec.ts src/content-os-portfolio/content-os-portfolio.service.request.spec.ts --no-coverage
```

```
PASS src/content-marketing/content-item.service.spec.ts
PASS src/content-os-portfolio/content-os-portfolio.service.request.spec.ts

Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        5.501 s, estimated 7 s
Ran all test suites matching /src\/content-marketing\/content-item.service.spec.ts|src\/content-os-portfolio\/content-os-portfolio.service.request.spec.ts/i.
```

**Commit:** `fix(cmkte): reuse portfolio CNT seq for masters`
