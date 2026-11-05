import { evaluateKpiContractScore } from './service-kpi-contract-score';

describe('evaluateKpiContractScore', () => {
  it('QT-0089 GM 22.4% + aggressive CPL blocks submit (AC-SKPI-06)', () => {
    const r = evaluateKpiContractScore({
      classificationRisk: 22,
      targetAggressiveness: 28,
      assumptionOpen: 12,
      dataReadinessGap: 8,
      marginPressure: 18,
      gmBps: 2240,
      gmFloorBps: 2500,
    });
    expect(r.score).toBe(19);
    expect(r.blockSubmit).toBe(true);
    expect(r.requiredReviewers).toEqual(['Finance', 'GDKD', 'Strategy']);
  });

  it('does not block when GM ok even if score parts high', () => {
    const r = evaluateKpiContractScore({
      classificationRisk: 80,
      targetAggressiveness: 80,
      assumptionOpen: 80,
      dataReadinessGap: 80,
      marginPressure: 10,
      gmBps: 3000,
      gmFloorBps: 2500,
    });
    expect(r.blockSubmit).toBe(false);
  });
});
