# Task 13 report — List + Create UI (LST-01, NEW-01)

**Status:** DONE  
**Branch:** `feat/quotation-os`  
**Commit:** `252dfe2e` `feat(qt): quote list and create wizard`

## What shipped

- `QtQuoteList` on `/crm/proposals/list` — chips Tất cả / Của tôi / Chờ tôi phê duyệt / Sắp hết hạn / Đã gửi chưa phản hồi; `GET /api/crm/proposals` via `qtFetch` (`scope`, `status`, `q`, `expiring`, `pending_my_approval`, `page`, `page_size`).
- Tile-1 `?open=1` activates mine-open (default) or all-open when `scope=all|team`.
- Columns: mã, ver, khách, lead, phương án (`—` W1), tổng, phí, GM (`—` if null / !finance), status, hiệu lực, owner. `dash(null)==='—'`.
- `QtCreateForm` on `/crm/proposals/new` — three source cards (lead | am360 | blank); named `<select name="lead_id">` and `<select name="agency_client_id">` (AM list `GET /api/crm/am/accounts`; staff leads `GET /api/v1/leads`). Prefills `lead_id` / `customer_id` / `agency_client_id` from Deal Room redirect.
- `POST /api/crm/proposals` with `Idempotency-Key` and `{ source, lead_id?, agency_client_id?, customer_id?, title, quote_type }`.
- Playwright helper `createQuoteFromLeadApi` in `e2e/helpers/qt-w1-helpers.ts` (for Task 19). No W1 UAT spec.

Vietnamese copy. `qt-*` classes. No extra `<main>`. No NOVA. No mockup `265.647.600` / `8,46`.

## TDD

### RED

1. Wrote `QtQuoteList.spec.ts` and `QtCreateForm.spec.ts` first (no production modules).
2. First run (wrong/root Vitest): `Cannot find module './QtCreateForm'` and `Cannot find package '@/lib/crm/qt-format'` — fail because feature files missing.
3. Project Vitest (`v3.2.7`) after stubs/implementation-in-progress:
   - Markup tests: `React is not defined` (jsx runtime in node env — same pattern as QtOverview: import `React`).
   - `open=1` query: `objectContaining({ pending_my_approval: undefined })` failed when keys were omitted (assertion too strict, not missing behavior). Tightened to `toBeUndefined()` checks.
4. Expected behavioral RED was “module / export missing”; assertion RED after React import would have been missing chips/selects/payload. Those assertions now pass against real markup + `buildQuoteCreateRequest`.

### GREEN

```
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/components/crm/qt src/lib/crm/qt-format.spec.ts \
  src/lib/crm/qt-nav.util.spec.ts src/lib/crm/qt-redirect.spec.ts
```

**30 passed / 7 files** (10 new in list+create specs).

| Spec | Result |
|---|---|
| Null columns → `—`; no `265.647.600` / `8,46`; no `<main>` | pass |
| Chips All / Mine / Pending / Expiring / Sent no reply (VI) | pass |
| `?open=1` → mine; `open=1&scope=all` → all-open | pass |
| Chip → `pending_my_approval` / `expiring` / `status=sent` / `scope=me` | pass |
| Named `<select>` lead + client; no `<input name="agency_client_id">` | pass |
| Three source cards | pass |
| Create from lead → `source:'lead'` + `lead_id` + `Idempotency-Key` | pass |
| Prefill from `lead_id` / `customer_id` / `agency_client_id` | pass |

## Concerns

- List API has no `open` or `viewed_no_reply` query. `?open=1` only sets chip/scope (does not send multi-status). “Đã gửi chưa phản hồi” maps to `status=sent` (misses `viewed`).
- Client options come from `GET /api/crm/am/accounts` (brief product name `/api/crm/agency/clients` was not invented).
- Browser click-through not run (no live ops-web session in this subagent). Playwright helper is API-only; full W1 UAT is Task 19.
- `qtFetch` now allows `''` / `?qs` so list/create hit `/api/crm/proposals` without a trailing slash.

## Files

- `services/ops-web/src/components/crm/qt/QtQuoteList.tsx` + `.spec.ts`
- `services/ops-web/src/components/crm/qt/QtCreateForm.tsx` + `.spec.ts`
- `services/ops-web/src/app/crm/proposals/list/page.tsx`
- `services/ops-web/src/app/crm/proposals/new/page.tsx`
- `services/ops-web/src/lib/crm/qt-api.ts`
- `services/ops-web/src/app/crm/proposals/qt.css`
- `services/ops-web/e2e/helpers/qt-w1-helpers.ts`

---

## Review fix (Important)

**Status:** DONE  
**Commit:** `fix(qt): prefill client select and filter open list`

### Fixes

1. Deal Room `?lead_id=` + loaded lead with `client_id` fills `<select name="agency_client_id">` via `resolveAgencyClientFromLead` (URL `agency_client_id` wins if present).
2. `?open=1` now filters draft…negotiation: `listQueryFromSearch` sets `open` + comma statuses; `getQtQuotes` / `buildQtListSearchParams` send `open=1` and `status=draft,…,negotiation`. API `QuoteListService` accepts `open=1` (IN `QT_OPEN_STATUSES`) or comma-separated `status`. Controller forwards `open`.
3. Chip “Đã gửi chưa phản hồi” sends `status=sent,viewed`.
4. List pager Trước / Sau, disabled at ends (`page` / `page_size` / `total` unchanged).

Kept: no UUID text input; named selects; Idempotency-Key; three sources; dash; no second `<main>`.

### TDD

RED (feature missing): `resolveAgencyClientFromLead` / `QT_OPEN_LIST_STATUSES` / `QtListPager` undefined; sent chip still `status=sent`; API `open` not on `QuoteListQuery`.

GREEN:

```
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/components/crm/qt/QtCreateForm.spec.ts \
  src/components/crm/qt/QtQuoteList.spec.ts
```

**14 passed / 2 files** (QtCreateForm 6, QtQuoteList 8).

```
cd services/ptt-crm-api && ./node_modules/.bin/jest --verbose src/proposals/quote-list.service.spec.ts
```

**6 passed / 1 file** (comma IN + `open=1` exclude accepted/expired).

| Spec | Result |
|---|---|
| `?lead_id=` + lead.client_id → named client select UUID | pass |
| URL `agency_client_id` not overwritten by lead | pass |
| `?open=1` → `open=1` + status draft…negotiation, no accepted/expired | pass |
| Sent chip → `status=sent,viewed` | pass |
| Pager prev disabled page 1; next disabled last page | pass |
| API comma `sent,viewed` → `IN` | pass |
| API `open=1` → IN open statuses, no accepted/expired | pass |

### Concerns

- Browser click-through not run. Single-status `status=` still uses `p.status = $` (unchanged).
- Client options still from `GET /api/crm/am/accounts`.
- `open=1` and a sent/pending/expiring chip together: chip wins (open filter not applied).
