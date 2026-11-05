import {
  applyLegalStatusScoreBoost,
  enrichLegalStatus,
  legalEnrichEnabled,
} from './legal-status.util';

describe('legal-status.util', () => {
  const prevEnrich = process.env.PTT_RESEARCH_HARVEST_LEGAL_ENRICH;
  const prevAdapter = process.env.PTT_RESEARCH_HARVEST_LEGAL_ADAPTER;

  afterEach(() => {
    if (prevEnrich === undefined) delete process.env.PTT_RESEARCH_HARVEST_LEGAL_ENRICH;
    else process.env.PTT_RESEARCH_HARVEST_LEGAL_ENRICH = prevEnrich;
    if (prevAdapter === undefined) delete process.env.PTT_RESEARCH_HARVEST_LEGAL_ADAPTER;
    else process.env.PTT_RESEARCH_HARVEST_LEGAL_ADAPTER = prevAdapter;
  });

  it('flag off by default', () => {
    delete process.env.PTT_RESEARCH_HARVEST_LEGAL_ENRICH;
    expect(legalEnrichEnabled()).toBe(false);
  });

  it('stub returns unverified', async () => {
    process.env.PTT_RESEARCH_HARVEST_LEGAL_ADAPTER = 'stub';
    const r = await enrichLegalStatus({
      company_name: 'Spa Test',
      address: 'HN',
      province_name: 'Hà Nội',
      phone: '0903111222',
      website: null,
    });
    expect(r.status).toBe('unverified');
    expect(r.source).toBe('stub');
  });

  it('verified boosts score by 10', () => {
    expect(applyLegalStatusScoreBoost(60, 'verified')).toBe(70);
    expect(applyLegalStatusScoreBoost(60, 'unverified')).toBe(60);
    expect(applyLegalStatusScoreBoost(60, 'mismatch')).toBe(55);
  });
});
