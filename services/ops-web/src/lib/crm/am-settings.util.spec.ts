import { describe, expect, it } from 'vitest';
import { amSettingsBandsError, amSettingsWeightsError } from './am-settings.util';

describe('am-settings', () => {
  it('amSettingsWeightsError when weights do not sum to 100', () => {
    expect(
      amSettingsWeightsError({
        kpi_delivery: 29,
        engagement: 20,
        financial: 20,
        satisfaction: 15,
        contract_support: 15,
      }),
    ).toBe('weights_sum');
    expect(
      amSettingsWeightsError({
        kpi_delivery: 30,
        engagement: 20,
        financial: 20,
        satisfaction: 15,
        contract_support: 15,
      }),
    ).toBeNull();
  });

  it('amSettingsBandsError when bands overlap or are not contiguous 0-100', () => {
    expect(
      amSettingsBandsError({
        healthy: [80, 100],
        watch: [60, 80],
        at_risk: [40, 59],
        critical: [0, 39],
      }),
    ).toBe('bands_overlap');
    expect(
      amSettingsBandsError({
        healthy: [80, 100],
        watch: [60, 79],
        at_risk: [40, 59],
        critical: [0, 39],
      }),
    ).toBeNull();
  });
});
