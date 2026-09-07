# Task 14 Report: Media UI (MED-01/03/05)

## Status

Implemented the Creative Production OS media library, ingest, rights center, and asset detail UI on `feat/cp-os`.

- Bound asset list/create/get, usage, rights, and finalize routes through `cp-api`.
- Added the exact ten-entry frontend MIME allowlist and pre-POST `mime_not_allowed` validation.
- Added library type filters, grid selection, and a data-backed inspector.
- Added ingest creation with optional finalize, plus a rights editor and expiry policy table.
- Added asset metadata, usage, and rights status detail.
- Routed `?tab=ingest` and `?tab=rights`; collections and quality retain media chrome and render `Chưa có dữ liệu` with `—`.
- Kept pages inside the existing `CpShell` main and removed fabricated metrics and later-wave copy.

## TDD evidence

Red:

```text
FAIL src/lib/crm/cp-format.rights.spec.ts
TypeError: rightsStatus is not a function
Tests 4 failed (4)
```

Green:

```text
✓ src/lib/crm/cp-format.rights.spec.ts (4 tests)
Test Files 1 passed (1)
Tests 4 passed (4)
```

The focused contract covers missing expiry, the required block and warn examples, and the post-window `ok` result.

## Verification

- Focused CP format tests: 10/10 passed across 2 files.
- Production `next build`: passed.
- Cursor diagnostics on Task 14 files: no errors.
- `git diff --check`: passed.
- Forbidden sample values and `Wave` copy audit: no matches in Task 14 media components.

## Concerns

- The Task 7 list/get payload exposes `expiry_on` and computed status but not the remaining rights row fields, so unavailable license, territory, channel, and release cells correctly render `—`.
- Repository-wide `tsc --noEmit` remains non-zero because of existing unrelated E2E and utility-spec errors; no Task 14 path appeared in that output.
