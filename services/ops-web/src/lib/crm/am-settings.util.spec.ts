import { describe, expect, it } from 'vitest';
import {
  AM_BDS_FIELD_TEMPLATES,
  AM_SLA_DEFAULTS,
  amApiKeyError,
  amParseHolidays,
  amSettingsBandsError,
  amSettingsWeightsError,
} from './am-settings.util';

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

  it('validates api_key slug and ships BĐS draft templates plus VN SLA defaults', () => {
    expect(amApiKeyError('project_name')).toBeNull();
    expect(amApiKeyError('Project')).toBe('api_key_invalid');
    expect(AM_BDS_FIELD_TEMPLATES.map((row) => row.api_key)).toEqual([
      'project_name',
      'leads_per_month',
    ]);
    expect(AM_SLA_DEFAULTS).toMatchObject({
      workday_start: '08:30',
      workday_end: '17:30',
      workdays: [1, 2, 3, 4, 5],
      pause_on_waiting_client: true,
      escalate_json: { '70': 'lead', '90': 'director', '100': 'executive' },
    });
    expect(amParseHolidays('2026-09-02\n2026-04-30')).toEqual(['2026-04-30', '2026-09-02']);
  });
});
