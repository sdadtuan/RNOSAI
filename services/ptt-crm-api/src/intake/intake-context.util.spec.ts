import { parseLeadMetaIndustry } from './intake-context.util';

describe('parseLeadMetaIndustry', () => {
  it('reads company and industry from object or json string', () => {
    expect(parseLeadMetaIndustry({ company: 'KTL', industry: 'BĐS' })).toEqual({
      company_name: 'KTL',
      industry: 'BĐS',
      industry_slug: null,
    });
    expect(parseLeadMetaIndustry('{"company_name":"X","industry_slug":"bds"}')).toEqual({
      company_name: 'X',
      industry: null,
      industry_slug: 'bds',
    });
  });

  it('returns nulls for garbage', () => {
    expect(parseLeadMetaIndustry(null)).toEqual({
      company_name: null,
      industry: null,
      industry_slug: null,
    });
  });
});
