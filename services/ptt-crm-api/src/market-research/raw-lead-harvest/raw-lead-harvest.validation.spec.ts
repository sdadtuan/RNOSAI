import {
  normalizeHarvestMode,
  validateCreateRawLeadHarvest,
} from './raw-lead-harvest.validation';

describe('validateCreateRawLeadHarvest', () => {
  const base = {
    industry_key: 'spa',
    job_title_key: 'owner',
    province_code: '01',
    source_keys: ['google_maps'],
    provider: 'openai',
    model: 'gpt-4o',
    target_count: 10,
  };

  it('requires at least one source', () => {
    expect(validateCreateRawLeadHarvest({ ...base, source_keys: [] })?.error).toBe(
      'source_keys_required',
    );
  });

  it('caps quality target_count at 25', () => {
    expect(
      validateCreateRawLeadHarvest({ ...base, mode: 'quality', target_count: 30 })?.error,
    ).toBe('target_count_quality_max_25');
  });

  it('defaults mode to quality', () => {
    expect(normalizeHarvestMode(undefined)).toBe('quality');
    expect(normalizeHarvestMode('volume')).toBe('volume');
  });

  it('accepts valid quality body', () => {
    expect(validateCreateRawLeadHarvest(base)).toBeNull();
  });
});
