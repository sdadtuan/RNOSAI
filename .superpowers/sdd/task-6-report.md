# Task 6 Report: Proposals PostgreSQL Cutover

**Status:** Complete
**Branch:** `feat/wave1-sqlite-to-pg`

## Summary

- Added `ProposalsPgRepository` with the full `crm_proposals` and
  `crm_quote_line_item` column sets from the SQLite schema.
- Preserved proposal, quote-line, lifecycle-linking, status, delete, and
  customer-name repository operations using parameterized PostgreSQL queries.
- Made quote-line replacement atomic with a PostgreSQL transaction.
- Rewired `ProposalsService`, `ProposalsModule`, `LeadMeetingPrepService`, and
  `DealRoomService` from `ProposalsSqliteRepository` to `ProposalsPgRepository`.
- Preserved the existing proposal and quote response shapes and PDF/DOCX export
  behavior.
- Left the legacy SQLite repository in the tree but disconnected from runtime
  wiring.

## TDD

RED:

```text
FAIL src/proposals/proposals-pg.repository.spec.ts
TS2307: Cannot find module './proposals-pg.repository'
```

GREEN:

```text
PASS src/proposals/proposals-pg.repository.spec.ts
3 tests passed
```

Coverage includes PostgreSQL-only wiring across all three consumers, complete
schema bootstrap, proposal row mapping, and parameterized proposal creation.

## Verification

```text
cd services/ptt-crm-api
npx jest src/proposals src/lead-meeting-prep src/deal-room --no-coverage
11 suites passed, 33 tests passed

npm run build
exit 0
```

## Concerns

- No live PostgreSQL/UI smoke was run; repository tests mock the PostgreSQL
  pool. The `/crm` proposal and quote creation smoke remains for an environment
  with PostgreSQL and staff authentication.
- Existing SQLite proposal and quote-line records require the separate
  migration/backfill process before production cutover.
- The npm commands emit the existing unsupported `devdir` configuration
  warning.

## Commit

`Serve CRM proposals from PostgreSQL only.`
