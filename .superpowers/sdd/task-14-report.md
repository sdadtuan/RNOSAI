# Task 14 report — Builder UI W1 (BLD-01…07 chrome)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/quotation-os`  
**Commit:** `43bb62c9` `feat(qt): builder workspace with SKU and sticky commercial`  
**Fix commit:** `fix(qt): omit unknown line money and return QT GET fields`

## What shipped

- `QtBuilder` on `/crm/proposals/[id]` — seven tabs always render. W1 live: Bối cảnh, Dịch vụ (SKU `basic|standard|premium` → Cơ bản / Tiêu chuẩn / Chuyên sâu), Chi phí (finance-gated), Điều khoản (payment 50/30/20, remainder on last, `pct_bps` sum 10000).
- W2 chrome still renders empty/`—`: Phương án one implicit A; KPI table empty; History v1 only. Never “mở ở Wave”.
- `QtStickyCommercial` — fee, media, discount, VAT, payable, payment flow. NSR/GM only if `crm_quote.finance`.
- Writes via `qtFetch`: `PATCH /:id` If-Match `row_version`; `PUT /:id/lines` (QT fields, no `cost_*` unless finance); `PUT /quote-versions/:vid/payments`; `POST /:id/versions/:vid/recalculate` (`?section=finance` only with cap).
- Draft catalog CTA disabled (`can_add_to_client_quote=false` / `catalog_not_active`).
- Vietnamese status pills. `dash(null)==='—'`. `qt-*`. No second `<main>`. No NOVA. No hard-coded `265.647.600` / `8,46`.

## TDD

### RED

```
cd services/ops-web && npm run test:unit -- \
  src/components/crm/qt/QtStickyCommercial.spec.ts \
  src/components/crm/qt/QtBuilder.spec.ts
```

Specs written first. First run (no production modules):

```
FAIL  QtBuilder.spec.ts
Error: Cannot find module './QtBuilder'
FAIL  QtStickyCommercial.spec.ts
Error: Cannot find module './QtStickyCommercial'
```

Expected: feature files missing.

### GREEN

Same command after implementation:

```
Test Files  2 passed (2)
     Tests  9 passed (9)
```

Full QT frontend suite:

```
cd services/ops-web && npm run test:unit -- \
  src/components/crm/qt src/lib/crm/qt-format.spec.ts \
  src/lib/crm/qt-nav.util.spec.ts src/lib/crm/qt-redirect.spec.ts
```

**43 passed / 9 files** (9 new in builder + sticky specs).

| Spec | Result |
|---|---|
| Sticky hides NSR/GM without finance | pass |
| Sticky shows NSR/GM with finance | pass |
| Null money → `—`; no mockup `265.647.600` | pass |
| Seven tabs Vietnamese; no “mở ở Wave”; no `<main>` / NOVA | pass |
| SKU keys basic\|standard\|premium; labels Cơ bản / Tiêu chuẩn / Chuyên sâu | pass |
| Draft catalog CTA disabled + `catalog_not_active` | pass |
| W2: one A + empty KPI + history v1 | pass |
| Status pills Vietnamese | pass |

## Concerns

- `GET /api/crm/proposals/:id` (legacy `mapProposalRow`) omits QT header fields (`title`, `objective`, `audience`, `campaign_period`, `agency_client_id`). BLD-01 starts empty until PATCH; list/create already have title on the row.
- `GET /:id/lines` legacy mapper drops `item_type` / `media_*` / `catalog_snapshot_json` / cost. After `PUT` the builder holds the full payload; first paint may only have `dv_code` + `package_tier`.
- Recalc on load 400s when header incomplete or no client-visible line — swallowed except `missing_cap`.
- Browser click-through not run (no live ops-web staff session in this subagent).
- `QtBuilder.tsx` is large (~850 lines) as the plan’s single file.

## Files

- `services/ops-web/src/components/crm/qt/QtBuilder.tsx` + `.spec.ts`
- `services/ops-web/src/components/crm/qt/QtStickyCommercial.tsx` + `.spec.ts`
- `services/ops-web/src/app/crm/proposals/[id]/page.tsx`
- `services/ops-web/src/lib/crm/qt-api.ts`
- `services/ops-web/src/app/crm/proposals/qt.css`

---

## Review fix — Important (GET fields + write payload)

**Status:** FIXED  
**Commit:** `fix(qt): omit unknown line money and return QT GET fields`

### What changed

- `lineWritePayload` omits `item_type` / `media_vnd` when unknown (same as cost_*). Never sends missing `cost_*` as `0`.
- `mapProposalRow`: Quote OS rows (`quote_code` or `current_version_id`) return title, objective, audience, `campaign_period`, `agency_client_id`, `row_version`, **raw** 14-status, `current_version_id`. Unknown status is not mapped to `draft`.
- `mapLineRow({ quoteOs: true })`: `item_type`, `media_vnd`, `client_visible`, `catalog_snapshot_json`, `qty`, `package_tier`; `cost_*` only if present (null not 0).
- Deal Room GET shape unchanged (no QT keys; unknown status still → `draft`).
- `GET detail/lines` requests `listLines(id, { quoteOs: true })` only for quote rows.
- Builder `isQtWritable` = raw status `=== 'draft'` and version state working (default working). `pending_approval` is not writable.

### TDD

#### RED

```
cd services/ops-web && npm run test:unit -- \
  src/components/crm/qt/QtBuilder.spec.ts \
  src/components/crm/qt/QtStickyCommercial.spec.ts
```

```
FAIL  QtBuilder.spec.ts
  isQtWritable is not a function
  expected payload not to have property "item_type"  (received "fee")
```

```
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/proposals/proposals-pg.repository.spec.ts \
  src/proposals/proposals.service.spec.ts --no-coverage
```

```
FAIL  proposals-pg.repository.spec.ts
  Module has no exported member 'mapLineRow' / 'mapProposalRow'
FAIL  proposals.service.spec.ts
  Property 'title' does not exist on detail type
```

#### GREEN

ops-web:

```
Test Files  2 passed (2)
     Tests  14 passed (14)
```

| Spec | Result |
|---|---|
| Sticky hides NSR/GM without finance | pass |
| Draft catalog CTA disabled | pass |
| no finance + missing cost → no cost keys | pass |
| missing media/item_type → omitted | pass |
| finance + real cost → included | pass |
| missing cost_* never sent as 0 | pass |
| pending_approval not writable / not painted Nháp | pass |

ptt-crm-api focused:

```
Test Suites: 3 passed
Tests:       49 passed
```

(`proposals-pg.repository.spec` + `proposals.service.spec` + `quote-builder.service.spec`)

### Remaining concerns

- Recalc on load still 400s when header incomplete or no client-visible line — swallowed except `missing_cap`.
- Browser click-through not run.
- GET does not yet return `current_version_state`; writable treats missing state as `working`.
