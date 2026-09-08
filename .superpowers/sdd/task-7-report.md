# Task 7 report — List + create from Lead / AM 360 (LST-01, NEW-01)

**Status:** complete  
**Branch:** `feat/quotation-os`  
**Commit:** `7cd1b966` `feat(qt): scoped list and create from lead or AM 360`

## What shipped

- `quote-create.service.ts` — NEW-01 from `lead` / `am360` / `blank`
  - Allocates `quote_code` via `nextval('crm_quote_code_seq')` + `formatQuoteCode`
  - Working version `n=1`, audit `quote.created`
  - Unknown client UUID → 400 `client_not_found`; never `INSERT INTO clients`
  - `Idempotency-Key` required; replay via `crm_quote_activity` snapshot
- `quote-list.service.ts` — LST-01 scoped list (`me`/`team`/`all` via `quote-scope.util`)
  - Filters: `status`, `q`, `expiring`, `pending_my_approval`, `page`, `page_size`
  - `gm_bps` + cost/`nsr` keys stripped unless finance
  - `option` is always `null` (W1)
- `proposals.service.ts` / controller
  - `create()` delegates when `title` / `agency_client_id` / `source` present
  - Deal Room `create()` and `GET /?customer_id=` / `?lead_id=` unchanged
  - `GET /` without those query params uses quote-list
  - POST reads `Idempotency-Key`

## TDD evidence

### RED (stubs / missing wiring)

```
FAIL quote-create.service.spec.ts — not implemented / expected client_not_found
FAIL quote-list.service.spec.ts — lastSql "" (no owner_staff_id / filters)
FAIL proposals.service.spec.ts — Expected 8 arguments, but got 10
```

Watched create/list fail on missing behavior (not typos) before implementing.

### GREEN

```
cd services/ptt-crm-api && ./node_modules/.bin/jest --verbose src/proposals
Test Suites: 16 passed, 16 total
Tests:       64 passed, 64 total
```

Task 7 cases:

| Spec | Result |
|---|---|
| AC-01 create from lead → draft + `QT-PTT-2026-000089` + working v1 + `quote.created` | PASS |
| Unknown client UUID → 400 `client_not_found` | PASS |
| Create does not INSERT clients | PASS |
| Idempotency-Key required | PASS |
| AC-12 scope `me` hides other owner | PASS |
| No cost/`gm_bps` without finance | PASS |
| Deal Room create/list still use repo | PASS |
| `proposals-pg.repository.spec.ts` | PASS |

## Concerns

- Idempotency replay is activity-snapshot lookup, not a dedicated keys table (no Task 1 DDL for it).
- Lead with only `converted_customer_id` skips `clients` lookup (allowed by “agency or customer”).
- Scoped `GET /` now resolves staff via `quoteCaller`; Deal Room query params still skip that path.
- `page_size` clamped to 25/50/100; W1 `option` always null.
- `pending_my_approval` filters `status = pending_approval` (no approval-steps table in W1).

---

# Review fixes (Important)

**Status:** complete  
**Commit:** `fix(qt): resolve staff and transactional idempotent create`

## What changed

1. **Staff resolution on POST create**
   - JWT with null/`<=0` `resolveCrmStaffUserId` → `403 { error: 'qt_unresolved_staff' }` (controller, same as `quoteCaller`).
   - `staffId: 0` only when `staffAuthVia === 'internal'` and no `staffUser`.
   - Quote OS create (`isQuoteOsCreate`) also rejects unresolved JWT at `proposals.service` / `quote-create.service`.
   - JWT never persists `owner_staff_id` / `created_by` as 0.
   - Shared POST still uses `StaffProposalsWriteGuard` (`crm_board.edit` OR `crm_quote.edit`). Not replaced with `StaffQuoteGuard` + `RequireQuoteAction('edit')`.

2. **Create is one real transaction**
   - `QuoteSettingsRepository.withTransaction()` uses `pool.connect()` + BEGIN/COMMIT/ROLLBACK on that client.
   - Optional `QuoteQueryPort.withTransaction`; mocks can run `fn` against the same `query`.
   - Proposal insert + version n=1 + `current_version_id` + `quote.created` audit all use the same client (`audit.insert(..., query)`).

3. **Idempotency under concurrency**
   - Inside the transaction: `SELECT pg_advisory_xact_lock(hashtext($1))`, re-check `findByIdempotencyKey`, then insert.
   - Replay same key → same proposal id / `quote_code`; no second `nextval`.

4. **List `q` matches displayed lead code**
   - Search `('LD-' || p.lead_id)` as well as `lead_id`, `quote_code`, title, client name.

5. **Quote year**
   - `quoteCodeYear()` uses `Asia/Ho_Chi_Minh`, not `new Date().getFullYear()` UTC.

## Command

```
cd services/ptt-crm-api && ./node_modules/.bin/jest --verbose src/proposals
```

## Test output summary

```
Test Suites: 16 passed, 16 total
Tests:       74 passed, 74 total
```

Review cases:

| Spec | Result |
|---|---|
| JWT unresolved staff → 403 `qt_unresolved_staff` (controller + service + create) | PASS |
| Internal key still creates with staffId 0 | PASS |
| Same Idempotency-Key replay → same proposal; no second `nextval` | PASS |
| `q=LD-12` matches `('LD-' \|\| p.lead_id)` | PASS |
| AC-01 create from lead | PASS |
| AC-12 scope `me` | PASS |
| Unknown client UUID → `client_not_found` | PASS |
| Create does not INSERT clients | PASS |
| Quote year ICT (`2026-12-31T20:00Z` → 2027) | PASS |
| POST keeps `StaffProposalsWriteGuard` | PASS |

## Remaining concerns

- Idempotency still keys off `crm_quote_activity.snapshot_json->>'idempotency_key'` (no dedicated keys table / unique index). Advisory xact lock serializes same-key creates; a unique constraint would still be stronger.
- Fast-path replay runs *before* the lock; concurrent first-writes still serialize inside the transaction.
- Client/lead reads stay outside the write transaction (stale-read window is acceptable for W1).
- Deal Room create (non-Quote-OS) still does not persist `owner_staff_id` from the resolved JWT.
