import { validateReadiness } from './service-kpi-readiness';

describe('validateReadiness', () => {
  it('blocks PROJECTED_RESULT client-visible without disclaimer', () => {
    const r = validateReadiness({
      classification: 'PROJECTED_RESULT',
      clientVisible: true,
      hasDefinition: true,
      hasQuantityOrTarget: true,
      hasDisclaimer: false,
      hasAssumption: true,
      hasScenario: true,
      hasDataSource: true,
      hasOwner: true,
    });
    expect(r.level).toBe('blocking');
    expect(r.errors.some((e) => e.field === 'disclaimer')).toBe(true);
  });

  it('INTERNAL_OPERATIONAL never requires disclaimer', () => {
    const r = validateReadiness({
      classification: 'INTERNAL_OPERATIONAL',
      clientVisible: false,
      hasDefinition: true,
      hasQuantityOrTarget: true,
      hasDisclaimer: false,
      hasAssumption: false,
      hasScenario: false,
      hasDataSource: true,
      hasOwner: true,
    });
    expect(r.level).toBe('pass');
  });
});
