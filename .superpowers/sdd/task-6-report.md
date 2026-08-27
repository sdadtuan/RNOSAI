# Task 6 report — Leads funnel PostgreSQL-only cutover

## Status

Implemented Wave 2 Task 6 only.

- `LeadsFunnelService` now delegates all funnel, review-queue, care, presales, marketing-plan, solution-handoff, AI-assist, and workflow-upgrade operations to `LeadsFunnelPgRepository`.
- Removed every `usePgFunnel` branch and the SQLite funnel repository injection.
- `LeadsFunnelModule` now provides and exports PostgreSQL funnel dependencies only.
- Updated the review-queue guard and leads repository integration to use the PostgreSQL funnel repository exclusively.
- Removed the unused SQLite funnel injection from `SqliteLeadsRepository`.
- Deleted `leads-funnel-sqlite.repository.ts` and `presales-funnel-metrics-load.sqlite.util.ts`; funnel metrics already use the PostgreSQL loader.
- `chot-closed-loop.service.ts`, `lead-sla-care.service.ts`, and `lead-status-gate.service.ts` did not inject the SQLite funnel repository, so no Task 6 changes were required there.
- Confirmed no deleted repository imports, `LeadsFunnelSqliteRepository`, `usePgFunnel`, or SQLite funnel metrics loader references remain under `src`.
- Task 7 was not started.

## Verification

- `npm --prefix services/ptt-crm-api test -- src/leads-funnel src/leads --testPathPattern='funnel|presales' --runInBand`
  - 36 suites passed.
  - 131 tests passed.
- `npm --prefix services/ptt-crm-api run build`
  - Passed.

## Smoke coverage

The selected Jest suites cover funnel/presales utilities and the successful Nest build verifies PostgreSQL-only module wiring. No live PostgreSQL-backed funnel board, presales metrics, or review queue smoke was run because this task did not start a configured authenticated CRM environment.

## Concerns

- Production cutover requires PostgreSQL funnel data and schema migrations to be complete because the SQLite fallback has been removed.
- The npm commands emit the existing unsupported `devdir` configuration warning.

## Commit

`Serve leads funnel from PostgreSQL only.`
