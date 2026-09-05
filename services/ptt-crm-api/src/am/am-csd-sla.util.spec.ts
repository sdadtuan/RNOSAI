import { TEN_TICKET_SLA_FIXTURE, slaFixtureRow } from './am-csd-sla.fixture';
import { csdSlaRate as amRate } from './am-csd-sla.util';
import { csdSlaRate as csdRate } from '../csd/csd-sla-rate.util';

describe('csdSlaRate', () => {
  it('scores the shared 10-ticket fixture as 7/10 → 70 from both AM and CSD exports', () => {
    const am = amRate(TEN_TICKET_SLA_FIXTURE);
    const csd = csdRate(TEN_TICKET_SLA_FIXTURE);
    expect(am).toBe(70);
    expect(csd).toBe(70);
    expect(am).toBe(csd);
    expect(Math.abs((am ?? 0) - (csd ?? 0))).toBeLessThanOrEqual(0.1);
  });

  it('returns null when the in_scope-with-due sample is empty', () => {
    expect(amRate([])).toBeNull();
    expect(
      amRate([
        slaFixtureRow({ scope_status: 'out_of_scope' }),
        slaFixtureRow({
          first_response_due_at: null,
          resolve_due_at: null,
        }),
      ]),
    ).toBeNull();
  });
});
