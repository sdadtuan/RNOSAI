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

## Important fixes follow-up

- Moved bytes/hash finalize validation ahead of `createCpAsset`, preventing orphan `uploading` rows on client-side validation failure.
- Expanded scoped asset reads with existing rights fields so selecting an asset hydrates every editor control.
- Added controlled, prefilled rights inputs and a merge helper that preserves existing values, omits untouched blanks, and only changes nullable booleans when they already have values or the user toggles them.
- Updated the rights table to render the returned license, territory, channels, and release data; the earlier payload limitation concern is resolved.

TDD red:

```text
FAIL cp-media-form.util.spec.ts — Cannot find module './cp-media-form.util'
FAIL cp-assets.service.spec.ts — expected SQL to contain r.license_type
```

TDD green and verification:

```text
Frontend focused tests: 9/9 passed
Asset service focused tests: 3/3 passed
Ops web production build: passed
PTT CRM API build: passed
```

## Asset detail rights follow-up

- Asset detail now renders returned `license_type`, `territory`, `channels`, `model_release`, `talent_release`, `expiry_on`, and `rights_status`.
- Boolean releases render `Có` or `Không`; only nullish values render `—`.
- Per instruction, this follow-up used targeted diagnostics and diff checks without running a package suite.
