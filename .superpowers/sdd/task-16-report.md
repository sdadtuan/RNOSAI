# Task 16 report — Chrome APR / Studio / Reports / Settings

**Status:** DONE  
**Branch:** `feat/quotation-os`  
**Commit:** `feat(qt): placeholder chrome for approvals, studio, and reports`

## What shipped

- `QtApprovals` on `/crm/proposals/approvals` — APR-01 inbox chips Chờ tôi / Đã xử lý / SLA vỡ; empty table Quote · Trigger · Bước · SLA · Owner → `—`.
- `QtStudio` on `/crm/proposals/[id]/studio` — PRS-01 9-section nav (Cover … Xác nhận). Publish **disabled** with reason `version_not_approved`. Section body `—`.
- `QtReports` on `/crm/proposals/reports` — 5 tabs RPT-01…05; KPI / funnel / tables use `dash(null)` (`—`). Formula note: dashboard win-rate vs `sent-to-accepted`.
- `QtSettings` on `/crm/proposals/settings` — SET-01…06 tabs. Live `GET/PATCH /api/crm/proposals/settings` via `qtFetch`. `quote_code_pattern` (and currency / TZ / entity) readonly. PATCH allowlist only (`buildQtSettingsPatch`). `ai_enabled` visible; server ignores `true` unless `QT_AI_ENABLED=1`.

Vietnamese. `qt-*` classes. No extra `<main>`. No “sẽ có ở W2” / “mở ở Wave” / NOVA / Nhảy màn.

## TDD

### RED

Wrote four specs first. First run: `Cannot find module './QtApprovals'` (and Studio / Reports / Settings) — feature files missing.

### GREEN

```
cd services/ops-web && ./node_modules/.bin/vitest run \
  src/components/crm/qt src/lib/crm/qt-format.spec.ts \
  src/lib/crm/qt-nav.util.spec.ts
```

**56 passed / 13 files** (5 new in Task 16 specs).

| Spec | Result |
|---|---|
| Settings form `quote_code_pattern` readonly; SET-01…06 tabs | pass |
| PATCH drops `quote_code_pattern` / `currency_code`; allowlist only | pass |
| Studio 9 sections; publish disabled + `version_not_approved` | pass |
| Reports 5 tabs; `—` values; `sent-to-accepted` labeled | pass |
| Approvals empty table `—`; chips; no Wave / NOVA copy | pass |

## Concerns

- Approval / Studio / Reports have no W1 list/publish APIs — chrome + `—` only (data in later waves).
- `ai_enabled` checkbox can be checked in UI; PATCH may send `true`; API still persists `false` when env is off. After reload the box follows GET.
- Browser click-through not run (no live ops-web session). SET-02 policy table uses SRS default labels, not live approver rows.

## Files

- `services/ops-web/src/components/crm/qt/QtApprovals.tsx` + `.spec.ts`
- `services/ops-web/src/components/crm/qt/QtStudio.tsx` + `.spec.ts`
- `services/ops-web/src/components/crm/qt/QtReports.tsx` + `.spec.ts`
- `services/ops-web/src/components/crm/qt/QtSettings.tsx` + `.spec.ts`
- `services/ops-web/src/app/crm/proposals/approvals/page.tsx`
- `services/ops-web/src/app/crm/proposals/[id]/studio/page.tsx`
- `services/ops-web/src/app/crm/proposals/reports/page.tsx`
- `services/ops-web/src/app/crm/proposals/settings/page.tsx`
- `services/ops-web/src/lib/crm/qt-api.ts`
- `services/ops-web/src/app/crm/proposals/qt.css`
