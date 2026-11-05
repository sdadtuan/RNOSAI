import {
  isCredentialIdReferencedInJobs,
  isLeadLookupReferencedInJobs,
  isModelIdReferencedInJobs,
  isProviderCodeReferencedInJobs,
} from './harvest-delete-guard.util';

const sampleJobs = [
  {
    industry_key: 'spa',
    job_title_key: 'owner',
    provider: 'openai',
    model: 'gpt-4o-mini',
    credential_id: 7,
    sources_json: [{ key: 'google_maps' }, { key: 'company_website' }],
    channels_json: [{ key: 'organic_web' }],
  },
];

describe('harvest-delete-guard.util', () => {
  it('blocks industry / job_title / source / channel when snapped in jobs', () => {
    expect(isLeadLookupReferencedInJobs('industry', 'spa', sampleJobs)).toBe(true);
    expect(isLeadLookupReferencedInJobs('industry', 'bds', sampleJobs)).toBe(false);
    expect(isLeadLookupReferencedInJobs('job_title', 'owner', sampleJobs)).toBe(true);
    expect(isLeadLookupReferencedInJobs('source', 'google_maps', sampleJobs)).toBe(true);
    expect(isLeadLookupReferencedInJobs('source', 'news', sampleJobs)).toBe(false);
    expect(isLeadLookupReferencedInJobs('channel', 'organic_web', sampleJobs)).toBe(true);
  });

  it('blocks provider / model / credential when snapped in jobs', () => {
    expect(isProviderCodeReferencedInJobs('openai', sampleJobs)).toBe(true);
    expect(isProviderCodeReferencedInJobs('perplexity', sampleJobs)).toBe(false);
    expect(isModelIdReferencedInJobs('gpt-4o-mini', sampleJobs)).toBe(true);
    expect(isCredentialIdReferencedInJobs(7, sampleJobs)).toBe(true);
    expect(isCredentialIdReferencedInJobs(99, sampleJobs)).toBe(false);
  });
});
