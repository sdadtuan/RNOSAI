import { parseHarvestAiLeads } from './harvest-parse.util';

describe('parseHarvestAiLeads', () => {
  const sourceKeys = ['google_maps', 'company_website'];

  it('drops quality rows missing evidence_url', () => {
    const raw = JSON.stringify([
      { company_name: 'A Co', evidence_url: null, phone: '0901234567' },
      {
        company_name: 'B Co',
        evidence_url: 'https://b.example',
        evidence_snippet: 'B Co',
        phone: '0901111222',
      },
    ]);
    const out = parseHarvestAiLeads(raw, { mode: 'quality', sourceKeys });
    expect(out).toHaveLength(1);
    expect(out[0].company_name).toBe('B Co');
  });

  it('nulls discovered_via_source_key outside job source keys', () => {
    const raw = JSON.stringify([
      {
        company_name: 'C Co',
        evidence_url: 'https://c.example',
        evidence_snippet: 'C Co',
        discovered_via_source_key: 'linkedin_scrape',
      },
    ]);
    const out = parseHarvestAiLeads(raw, { mode: 'quality', sourceKeys });
    expect(out[0].discovered_via_source_key).toBeNull();
  });

  it('parses fenced JSON arrays', () => {
    const raw = '```json\n[{"company_name":"D","evidence_url":"https://d.example","evidence_snippet":"D"}]\n```';
    const out = parseHarvestAiLeads(raw, { mode: 'quality', sourceKeys });
    expect(out).toHaveLength(1);
    expect(out[0].company_name).toBe('D');
  });
});
