# Task 2 Report: Caps + route guard

**Status:** DONE  
**Branch:** `feat/am-os`  
**Commit:** `498cbcb4` — feat(am): register crm_am caps and fail-closed route guard  
**Date:** 2026-09-05

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Added `crm_am` / `crm_am.finance` in `section_actions`, `sections`, and `permission_ids` (next to `csd`) |
| `scripts/seed_am_rbac.sh` | Created (mode 755). Catalog-only reminder; **never** INSERTs `staff_section_permissions` |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/account-management` immediately before `/crm/csd` |
| `services/ops-web/src/lib/auth.spec.ts` | Three AM route tests from the brief |
| `services/ops-web/src/lib/crm/am-nav.util.ts` | Created — `canSeeAmNav` + `AM_NAV` (8 items, no `badge`) |
| `services/ops-web/src/lib/crm/am-nav.util.spec.ts` | Created — nav visibility + `AM_NAV` shape |

**Not done (out of scope):** OpsNav entry (Task 5). Nest `StaffAmGuard` (Task 3).

## TDD evidence

### RED — failing tests first

Wrote the three `auth.spec.ts` cases and `am-nav.util.spec.ts` **before** any production change. Ran local Vitest 3.2.7 (worktree `node_modules` symlink; `npx vitest` without the local binary pulled v5 from the monorepo root and is not valid evidence).

```
$ cd services/ops-web && node_modules/.bin/vitest run src/lib/auth.spec.ts src/lib/crm/am-nav.util.spec.ts

 FAIL  src/lib/auth.spec.ts > rbac-routes > AM path requires crm_am.view or view_all — agency-only is 403
 AssertionError: expected true to be false
   canAccessPath('/crm/account-management', agency, 'crm') → true
   (agency matched generic `/crm` because AM prefix missing)

 FAIL  src/lib/auth.spec.ts > rbac-routes > crm_am.view can open AM routes
 AssertionError: expected false to be true
   crm_am.view is not in generic `/crm` anyOf

 FAIL  src/lib/auth.spec.ts > rbac-routes > crm_am.view_all can open AM routes
 AssertionError: expected false to be true

 FAIL  src/lib/crm/am-nav.util.spec.ts
 Error: Cannot find module './am-nav.util'

 Test Files  2 failed (2)
      Tests  3 failed | 15 passed (18)
```

Failure reason matches the brief: prefix missing, agency user matches generic `/crm`.

### GREEN — implement, re-run

Added catalog entries, PATH_CAP_RULES prefix, `am-nav.util.ts`, catalog-only seed script. Re-ran the same command:

```
$ cd services/ops-web && node_modules/.bin/vitest run src/lib/auth.spec.ts src/lib/crm/am-nav.util.spec.ts

 ✓ src/lib/crm/am-nav.util.spec.ts (5 tests) 24ms
 ✓ src/lib/auth.spec.ts (18 tests) 20ms

 Test Files  2 passed (2)
      Tests  23 passed (23)
```

## Behavior

- `/crm/account-management` and nested paths require `crm_am.view` **or** `crm_am.view_all`.
- `crm_agency.view` alone is denied (fail-closed; no CSD-style agency fallback).
- `canSeeAmNav` is the same two caps; null/undefined → false.
- `AM_NAV` has 8 items in group order: TỔNG QUAN → KHÁCH HÀNG → CÔNG VIỆC → HỢP ĐỒNG → PHÂN TÍCH → CẤU HÌNH. No `badge`.
- Longest-prefix match still wins: `/crm/account-management` (24) is longer than `/crm` (4).

## Self-review

- Route rule sits immediately before `/crm/csd`, more specific than `/crm`.
- Catalog `section_actions` / `sections` values match the brief verbatim.
- `permission_ids` also lists `crm_am` and `crm_am.finance` next to `csd`. Brief named only `section_actions` + `sections`; this extra is required so `normalizeGrantPayload` does not drop Admin RBAC grants.
- Seed script prints a reminder and `exit 0`. No `--apply` grant path.
- Commit contains only the six files above. `.superpowers/`, `node_modules`, and unrelated files were not staged.
- `view_all` is not in `extra_action_labels`; Admin UI will show the raw action id until a later catalog polish.

## Concerns

None blocking. Optional follow-up: add `view_all` to `extra_action_labels` for a Vietnamese Admin label.
