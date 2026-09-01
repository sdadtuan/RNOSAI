# Task 12 Report: Hai lệnh C mới (T6) — CEO Lifecycle Tower

**Status:** DONE  
**Branch:** `feat/ceo-lifecycle-tower-t6-t8`  
**Base:** `04c04703` on main  
**Spec:** §20 — `remind_contract_approval`, `prioritize_solution_queue`

## Summary

Added two §20 CEO Command actions: remind GDKD to approve pending contracts (notification only, no status change) and prioritize Solution queue cases (notify MKT-01 + `meta_json.priority_consult='ceo'`). Enabled S3/S4 tower chips on the frontend.

## Backend

### `ceo-command-action.catalog.ts`

- Added `remind_contract_approval`, `prioritize_solution_queue` to `CEO_ACTION_IDS`
- `FORBIDDEN_PATTERNS`: `/duyet hop dong|approve contract/i` → `/crm/hub`
- `validateActionParams`, `requiredCapsForAction` → `ceo_command.act`, `previewVi` per plan
- Fixed `stripDiacritics` to normalize `đ/Đ` → `d/D` for Vietnamese contract phrases

### `ceo-command-actions.service.ts`

- **`remind_contract_approval`**: resolves GDKD via `submitted_to_staff_id` on approval (if present) or position `GDKD-01`; sends `staff_notifications` with `link_href=/crm/hub?lead_id=`; **no** contract status mutation
- **`prioritize_solution_queue`**: `mergeLeadMeta({ priority_consult: 'ceo' })`; notifies `MKT-01`; no owner change
- Helpers: `resolveStaffIdByPositionCode`, `resolveContractApprovalStaffId`

### Module wiring

- `ceo-command.module.ts`: imports `LeadsContractModule`
- `leads.module.ts`: exports `PgLeadsWriteRepository`

## Frontend

### `ceo-tower-suggest.util.ts`

- Removed `UPCOMING_ACTIONS` gate for S3/S4
- Maps `remind_contract_approval` → `{ lead_id, contract_id? }`
- Maps `prioritize_solution_queue` → `{ lead_id, note? }` (note from `title_vi` when absent)

## Tests

| Suite | Result |
|-------|--------|
| `ceo-command-action.catalog.spec.ts` | PASS — 9 tests |
| `ceo-command-actions.service.spec.ts` | PASS — 2 tests |
| `ceo-tower-suggest.util.spec.ts` | PASS — 13 tests |

```bash
cd services/ptt-crm-api && npx jest \
  src/ceo-command/ceo-command-action.catalog.spec.ts \
  src/ceo-command/ceo-command-actions.service.spec.ts --no-coverage
# 11 passed

cd services/ops-web && npx vitest run src/lib/crm/ceo-tower-suggest.util.spec.ts
# 13 passed
```

## Concerns

1. **`submitted_to_staff_id`** — not in current `crm_contract_approvals` schema; code reads it opportunistically from approval row, falls back to `GDKD-01` position lookup.
2. **Position resolution** — requires `crm_staff` + `crm_positions` rows for `GDKD-01` / `MKT-01`; fails with `gdkd_staff_not_found` / `mkt_staff_not_found` if roster empty.
3. **E2E** — `ceo-lifecycle-tower.spec.ts` still expects S3/S4 chips disabled (`upcoming` tooltip); update in a follow-up when e2e is in scope.

## Files touched

- `services/ptt-crm-api/src/ceo-command/ceo-command-action.catalog.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-command-action.catalog.spec.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-command-actions.service.ts`
- `services/ptt-crm-api/src/ceo-command/ceo-command-actions.service.spec.ts` (new)
- `services/ptt-crm-api/src/ceo-command/ceo-command.module.ts`
- `services/ptt-crm-api/src/leads/leads.module.ts`
- `services/ops-web/src/lib/crm/ceo-tower-suggest.util.ts`
- `services/ops-web/src/lib/crm/ceo-tower-suggest.util.spec.ts`
