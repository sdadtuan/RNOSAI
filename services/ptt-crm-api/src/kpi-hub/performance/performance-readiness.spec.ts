import { evaluateReadiness, validateTargetBand } from './performance-readiness';

describe('performance-readiness', () => {
  it('lower-is-better requires stretch ≤ target ≤ min (AC band)', () => {
    expect(validateTargetBand({ direction: 'lower', min: 85000, target: 100000, stretch: 70000 }).ok).toBe(true);
    expect(validateTargetBand({ direction: 'lower', min: 70000, target: 100000, stretch: 85000 }).ok).toBe(false);
    expect(validateTargetBand({ direction: 'higher', min: 800, target: 1000, stretch: 1200 }).ok).toBe(true);
    expect(validateTargetBand({ direction: 'higher', min: 1200, target: 1000, stretch: 1500 }).ok).toBe(false);
  });

  it('blocks activate when measurement plan missing on auto KPI', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: false,
      auto_tracked: true,
      client_visible: true,
      has_disclaimer: true,
    });
    expect(r.can_activate).toBe(false);
    expect(r.gates.find((g) => g.id === 'source')?.status).toBe('pending');
  });

  it('fails visibility when client-visible without disclaimer', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: true,
      auto_tracked: true,
      client_visible: true,
      has_disclaimer: false,
    });
    expect(r.gates.find((g) => g.id === 'visibility')?.status).toBe('fail');
    expect(r.can_activate).toBe(false);
  });

  it('passes all five gates', () => {
    const r = evaluateReadiness({
      definition_active: true,
      owner_active: true,
      band_valid: true,
      has_measurement_plan: true,
      auto_tracked: true,
      client_visible: false,
      has_disclaimer: false,
    });
    expect(r.can_activate).toBe(true);
    expect(r.gates.every((g) => g.status === 'pass')).toBe(true);
  });
});
