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

  it('requires a positive integer target_count', () => {
    expect(
      validateCreateRawLeadHarvest({ ...base, mode: 'quality', target_count: 0 })?.error,
    ).toBe('target_count_invalid');
    expect(
      validateCreateRawLeadHarvest({ ...base, mode: 'quality', target_count: 30 }),
    ).toBeNull();
    expect(
      validateCreateRawLeadHarvest({ ...base, mode: 'volume', target_count: 80 }),
    ).toBeNull();
  });

  it('defaults mode to quality', () => {
    expect(normalizeHarvestMode(undefined)).toBe('quality');
    expect(normalizeHarvestMode('volume')).toBe('volume');
    expect(normalizeHarvestMode('marketing')).toBe('marketing');
    expect(normalizeHarvestMode('intent')).toBe('intent');
    expect(normalizeHarvestMode('market_graph')).toBe('market_graph');
  });

  it('intent requires a concrete province (not all)', () => {
    expect(
      validateCreateRawLeadHarvest({
        ...base,
        mode: 'intent',
        province_code: 'all',
        target_count: 50,
        provider: undefined,
        model: undefined,
      })?.error,
    ).toBe('intent_province_required');
    expect(
      validateCreateRawLeadHarvest({
        ...base,
        mode: 'intent',
        province_code: '79',
        target_count: 50,
        provider: undefined,
        model: undefined,
      }),
    ).toBeNull();
  });

  it('market_graph requires a concrete province (not all)', () => {
    expect(
      validateCreateRawLeadHarvest({
        ...base,
        mode: 'market_graph',
        province_code: 'all',
        target_count: 50,
        provider: undefined,
        model: undefined,
      })?.error,
    ).toBe('market_graph_province_required');
    expect(
      validateCreateRawLeadHarvest({
        industry_key: 'spa',
        province_code: '79',
        source_keys: ['google_maps'],
        mode: 'market_graph',
        target_count: 100,
      }),
    ).toBeNull();
  });

  it('intent does not require AI provider/model', () => {
    expect(
      validateCreateRawLeadHarvest({
        industry_key: 'spa',
        province_code: '79',
        source_keys: ['google_maps'],
        mode: 'intent',
        target_count: 50,
      }),
    ).toBeNull();
  });

  it('accepts valid quality body', () => {
    expect(validateCreateRawLeadHarvest(base)).toBeNull();
  });

  it('allows empty job_title and province (Tất cả)', () => {
    expect(
      validateCreateRawLeadHarvest({
        ...base,
        job_title_key: '',
        province_code: '',
        ward_code: null,
      }),
    ).toBeNull();
  });
});
