# Task 12 report: OVR UI (OVR-01…03)

## Status

Done. Quotation OS overview dashboard, Action Center, and activity page consume Task 6 APIs via `qtFetch`.

## TDD

### RED

`vitest run src/components/crm/qt/QtOverview.spec.ts` from `services/ops-web`:

```
FAIL  src/components/crm/qt/QtOverview.spec.ts
Error: Cannot find module './QtOverview'
```

Expected: feature missing (QtOverview.tsx not created yet).

### GREEN

Same spec after implementation (plus existing Task 11 QT specs):

```
✓ src/lib/crm/qt-format.spec.ts (3 tests)
✓ src/lib/crm/qt-redirect.spec.ts (4 tests)
✓ src/lib/crm/qt-nav.util.spec.ts (3 tests)
✓ src/components/crm/qt/QtOverview.spec.ts (2 tests)
Test Files  4 passed (4)
Tests  12 passed (12)
```

Assertions:

- Render `QtKpiTiles` with all-null KPIs → four `<strong>—</strong>`
- Markup does not contain `8,46`, `265.647.600`, or `22,4`
- Win-rate tile shows formula text `accepted/(accepted+rejected)`
- Tile 1 href `/crm/proposals/list?open=1`; tile 2 href `/crm/proposals/approvals`
- `QtAlertBar` with `actions=[]` renders nothing

## What shipped

- `QtOverview.tsx`: exactly 4 KPI tiles in contract order (`open_quote_value`, `pending_approval_count`, `quote_win_rate`, `forecast_gross_margin`); `dash(null)==='—'`; GM/`forecast_gross_margin` stays `—` when null (no invented NSR)
- Alert bar only when `actions.length > 0`
- Action Center table from `GET /actions` at `?panel=actions` (OVR-02)
- `QtActivity.tsx` + `activity/page.tsx`: filters (Tất cả / Status / Approval / Share / Accept / Convert), search, CSV export via `/activity?export=csv` (OVR-03)
- `page.tsx` still runs `qtOverviewRedirect` for `id` / `wizard` / `lead_id`; overview renders when those are absent
- No extra `<main>` (QtShell / StaffPageShell already owns it)
- Class prefix `qt-*`; Vietnamese copy; no NOVA / Nhảy màn

## Manual rg

```
rg "Nhảy màn|Toàn catalog|NOVA|8,46|265\\.647\\.600|22,4" services/ops-web/src/components/crm/qt services/ops-web/src/app/crm/proposals
```

Matches only the Vitest assertions in `QtOverview.spec.ts` (forbidden-value guards). Production UI has none.

## Concerns

- Task 6 overview payload has no top-services list; the “Top dịch vụ theo giá trị” card is live-empty (`—`), not mockup sample rows.
- `GET /actions` accepts `scope` only (no `from`/`to`); Action Center is not period-filtered on the server.
- Activity `action=` is exact-match; Approval/Status chips therefore filter client-side (`approval|submit_approval`, `/status/`).
- Browser click-through was not run (no authenticated ops-web session in this task).

---

## Review fix (Important)

### Period label matches query

Empty `from`/`to` no longer labels **Tháng này** while calling the API with no dates. First load writes the current-month range (`Asia/Ho_Chi_Minh`) into the URL. `detectPeriod` returns `month` only when `from`/`to` equal that month. Kỳ options: 7 ngày / **30 ngày** / Tháng này / Quý này.

### Activity chips use exact `action=`

Approval chip sends `submit_approval` (not a mixed latest-100 + client filter). Share/Accept/Convert stay exact (`publication.viewed`, `accept`, `convert`). Status has no Task 6 1:1 `action=`; UI states that instead of silently dropping rows.

Kept: 4 tiles, win-rate formula, four `—` when null, tile hrefs, Task 11 redirects, no second `<main>`, no 8,46.

### Tests

`vitest run src/components/crm/qt/QtOverview.spec.ts src/components/crm/qt/QtActivity.spec.ts` from `services/ops-web`:

```
✓ src/components/crm/qt/QtActivity.spec.ts (4 tests)
✓ src/components/crm/qt/QtOverview.spec.ts (5 tests)
Test Files  2 passed (2)
Tests  9 passed (9)
```

### Concerns

- Status chip remains incomplete by design (no `status` action on Task 6).
- Approval is `submit_approval` only; `approval.*` is not grouped (API is exact-match).
- Default month is written client-side via `router.replace`.
