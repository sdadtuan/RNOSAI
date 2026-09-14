import { buildRawLeadsCsv } from './export-csv.util';

describe('export-csv.util', () => {
  it('exports header + rows with escaped commas', () => {
    const csv = buildRawLeadsCsv([
      {
        company_name: 'Spa A, HN',
        address: '12 Pho Hue',
        phone: '0903111222',
        email: 'a@spa.vn',
        contact_title: 'Owner',
        evidence_url: 'https://spa.vn',
        quality_score: 70,
        icp_fit_score: 60,
        source_provider: 'openai',
        source_model: 'gpt',
        search_source_keys: ['google_maps', 'company_website'],
        status: 'accepted',
      },
    ]);
    expect(csv.split('\n')[0]).toContain('company_name');
    expect(csv).toContain('"Spa A, HN"');
    expect(csv).toContain('google_maps|company_website');
  });
});
