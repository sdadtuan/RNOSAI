# Task 2 Report — CRM Staff PostgreSQL Cutover

## Status

Complete on branch `feat/wave2-sqlite-removal`.

## Summary

- Removed `CrmStaffSqliteRepository` and all `crmStaffPg` runtime branches from `CrmStaffService`.
- Injected and used `CrmStaffPgRepository` as the sole CRM staff persistence provider.
- Removed the SQLite provider from `CrmStaffModule`.
- Deleted `crm-staff-sqlite.repository.ts`.
- Added a regression spec that rejects SQLite repository imports in the service.

Public CRM staff operations remain available for staff listing/detail/workspace,
patching, KPI access, levels, competencies, and staff import.

## TDD

RED:

```text
FAIL src/crm-staff/crm-staff.service.spec.ts
Expected service source not to match CrmStaffSqliteRepository, but it did.
```

GREEN:

```text
PASS src/crm-staff/crm-staff.service.spec.ts
1 suite passed, 1 test passed
```

## Verification

```text
npm test -- src/crm-staff --runInBand
1 suite passed, 1 test passed

npm run build
exit 0
```

The npm commands emit the existing unsupported `devdir` configuration warning;
it does not affect either result.

## Commit

`Serve CRM staff from PostgreSQL only.`

## Smoke test

The VPS `/admin/crm/org/staff` list/detail smoke test was not run in this
session because no authenticated live target was provided.
