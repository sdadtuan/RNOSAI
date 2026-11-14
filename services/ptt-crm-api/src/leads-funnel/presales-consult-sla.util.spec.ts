import {
  buildPresalesConsultProposalSla,
  CONSULT_PROPOSAL_SLA_HOURS,
  isConsultToProposalWithin48h,
} from './presales-consult-sla.util';

describe('presales-consult-sla.util', () => {
  const now = new Date('2026-08-05T12:00:00Z');

  it('returns na when not in consult stage', () => {
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'lead',
      consultEnteredAt: '2026-08-04 10:00:00',
      stageEnteredAt: '2026-08-04 10:00:00',
      now,
    });
    expect(sla.sla_state).toBe('na');
  });

  it('keeps the retired 48h consult clock in na even after 48h', () => {
    const started = new Date(now.getTime() - (CONSULT_PROPOSAL_SLA_HOURS + 2) * 3_600_000);
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'consult',
      consultEnteredAt: started.toISOString(),
      stageEnteredAt: started.toISOString(),
      now,
    });
    expect(sla.sla_state).toBe('na');
    expect(sla.message).toMatch(/1 ngày làm việc/);
  });

  it('does not warn on the retired consult clock', () => {
    const started = new Date(now.getTime() - 40 * 3_600_000);
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'consult',
      consultEnteredAt: started.toISOString(),
      stageEnteredAt: started.toISOString(),
      now,
    });
    expect(sla.sla_state).toBe('na');
  });

  it('measures 48h compliance for completed handoff', () => {
    expect(
      isConsultToProposalWithin48h('2026-08-01 10:00:00', '2026-08-02 09:00:00'),
    ).toBe(true);
    expect(
      isConsultToProposalWithin48h('2026-08-01 10:00:00', '2026-08-04 10:00:00'),
    ).toBe(false);
  });
});
