import type { CsdSlaRateRow } from './am-csd-sla.util';

const RESP_DUE = '2026-09-01T05:00:00.000Z';
const RESOLVE_DUE = '2026-09-10T10:00:00.000Z';

function row(partial: Partial<CsdSlaRateRow>): CsdSlaRateRow {
  return {
    scope_status: 'in_scope',
    status: 'resolved',
    sla_status: 'on_track',
    created_at: '2026-08-20T01:00:00.000Z',
    first_response_at: '2026-09-01T04:00:00.000Z',
    first_response_due_at: RESP_DUE,
    resolved_at: '2026-09-09T08:00:00.000Z',
    closed_at: null,
    resolve_due_at: RESOLVE_DUE,
    ...partial,
  };
}

/**
 * Shared 10-ticket fixture (all in_scope with a due).
 * On-time (7): T1–T5 resolved on time; T6 still-open not breached; T7 no first_response (counts on-time).
 * Late (3): T8 late response; T9 late resolve; T10 still-open breached.
 * Expected rate = 7/10 → 70
 */
export const TEN_TICKET_SLA_FIXTURE: CsdSlaRateRow[] = [
  row({}),
  row({}),
  row({}),
  row({}),
  row({}),
  row({
    status: 'in_progress',
    sla_status: 'on_track',
    resolved_at: null,
    closed_at: null,
  }),
  row({ first_response_at: null }),
  row({ first_response_at: '2026-09-01T06:00:00.000Z' }),
  row({ resolved_at: '2026-09-11T12:00:00.000Z' }),
  row({
    status: 'in_progress',
    sla_status: 'breached',
    resolved_at: null,
    closed_at: null,
  }),
];

export { row as slaFixtureRow };
