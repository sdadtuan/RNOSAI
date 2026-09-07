# Task 11 Report: CpShell, CSS, routes, placeholders

## Status

Implemented the Creative Production OS shell and route skeleton on `feat/cp-os`.

- Added an eight-item capability-gated `CP_NAV` with the required ids and labels.
- Added `CpShell` with one `cp-main`, a `me|team|all` scope selector, and collapsible navigation.
- Added CP design tokens and `cp-*` styles using Be Vietnam Pro.
- Added `cpFetch` under `/api/crm/cp` and null-safe `dash`.
- Added all 19 requested route pages as thin placeholder entries.
- Placeholder content is centralized and renders a heading, `Chưa có dữ liệu`, and `—`.

## TDD evidence

Red:

```text
Test Files  2 failed (2)
Cannot find module './cp-format'
Cannot find module './cp-nav.util'
```

Green:

```text
Test Files  2 passed (2)
Tests       5 passed (5)
```

Command:

```bash
npm --prefix services/ops-web run test:unit -- \
  src/lib/crm/cp-nav.util.spec.ts \
  src/lib/crm/cp-format.spec.ts
```

## Additional checks

- Cursor diagnostics on Task 11 files: no linter errors.
- `git diff --check`: passed.
- Route inventory: 19 requested `page.tsx` files present.
- Markup audit: one `<main>` in `CpShell`; no page-level `<main>`.
- Forbidden-copy audit: no CP shell flag, catalog jump UI, Nova branding, Wave text, badges, or `RevOpsEmbedFrame`.

## Concern

The repository-wide TypeScript check is not green because of existing errors in unrelated E2E and utility spec files. The check reported no errors in Task 11 files.
