import {
  REVOPS_COMMISSION_KPI_WEIGHTS,
  buildCommissionProjections,
  categorizeCommissionDealRef,
  payoutStepIndex,
} from './revops-commission-hub.util';

describe('revops-commission-hub.util', () => {
  it('categorizes deal refs', () => {
    expect(categorizeCommissionDealRef('DEAL-renewal-01')).toBe('renewal');
    expect(categorizeCommissionDealRef('upsell-pack')).toBe('upsell');
    expect(categorizeCommissionDealRef('lead-sla-bonus')).toBe('sla');
    expect(categorizeCommissionDealRef('DEAL-001')).toBe('new');
  });

  it('builds projections from transactions when present', () => {
    const out = buildCommissionProjections(
      [
        { dealRef: 'NEW-1', commissionVnd: 1000000 },
        { dealRef: 'renewal-2', commissionVnd: 500000 },
      ],
      999,
    );
    expect(out.newVnd).toBe(1000000);
    expect(out.renewalVnd).toBe(500000);
    expect(out.totalVnd).toBe(1500000);
  });

  it('falls back to weighted split when no transactions', () => {
    const out = buildCommissionProjections([], 1000000);
    expect(out.newVnd).toBe(450000);
    expect(out.renewalVnd).toBe(250000);
    expect(out.upsellVnd).toBe(150000);
    expect(out.slaVnd).toBe(150000);
    expect(out.totalVnd).toBe(1000000);
  });

  it('maps payout step index', () => {
    expect(payoutStepIndex('draft')).toBe(1);
    expect(payoutStepIndex('locked')).toBe(2);
    expect(payoutStepIndex('reconciled')).toBe(3);
  });

  it('exposes weight constants', () => {
    expect(REVOPS_COMMISSION_KPI_WEIGHTS.newPct).toBe(45);
  });
});
