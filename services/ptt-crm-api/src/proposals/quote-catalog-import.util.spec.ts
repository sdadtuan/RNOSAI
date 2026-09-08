import { parseQuoteCatalogImport } from './quote-catalog-import.util';

describe('parseQuoteCatalogImport', () => {
  it('parses JSON rate cards and revisions without inventing cost 0', () => {
    const parsed = parseQuoteCatalogImport({
      json: {
        rate_cards: [
          {
            dv_code: 'DV08',
            package_tier: 'standard',
            fee_vnd: 18_000_000,
            cost_labor_vnd: null,
            effective_from: '2026-09-09',
            effective_to: null,
            state: 'active',
          },
        ],
        revisions: [{ catalog_service_id: 'DV08', profile_json: { name: 'Meta Ads' } }],
      },
    });

    expect(parsed.rate_cards).toHaveLength(1);
    expect(parsed.rate_cards[0]).toMatchObject({
      dv_code: 'DV08',
      package_tier: 'standard',
      fee_vnd: 18_000_000,
      cost_labor_vnd: null,
      effective_from: '2026-09-09',
      state: 'active',
    });
    expect(parsed.rate_cards[0].cost_labor_vnd).toBeNull();
    expect(parsed.revisions).toEqual([{ catalog_service_id: 'DV08', profile_json: { name: 'Meta Ads' } }]);
    expect(JSON.stringify(parsed)).not.toMatch(/"cost_labor_vnd":0/);
  });

  it('parses CSV rate rows and treats empty cost as null', () => {
    const csv = [
      'dv_code,package_tier,fee_vnd,cost_labor_vnd,effective_from,effective_to,state',
      'DV05,standard,16000000,,2026-09-09,,active',
    ].join('\n');

    const parsed = parseQuoteCatalogImport({ csv, filename: 'rates.csv' });

    expect(parsed.rate_cards).toHaveLength(1);
    expect(parsed.rate_cards[0].dv_code).toBe('DV05');
    expect(parsed.rate_cards[0].fee_vnd).toBe(16_000_000);
    expect(parsed.rate_cards[0].cost_labor_vnd).toBeNull();
    expect(parsed.revisions[0].catalog_service_id).toBe('DV05');
  });
});
