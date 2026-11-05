import {
  classifyMarketEntityChange,
  marketEntityContentHash,
} from './market-content-hash.util';

describe('market-content-hash.util', () => {
  it('hashes phone|website|company|address stably', () => {
    const a = marketEntityContentHash({
      phone: '0909 479 018',
      website: 'https://Spa.Example',
      company_name: 'Spa Hoa Mi',
      address: 'Q3,  HCM',
    });
    const b = marketEntityContentHash({
      phone: '0909479018',
      website: 'https://spa.example',
      company_name: 'Spa Hoa Mi',
      address: 'Q3, HCM',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when phone or website changes', () => {
    const base = marketEntityContentHash({
      phone: '0901111111',
      website: 'https://a.vn',
      company_name: 'Spa A',
      address: 'HCM',
    });
    expect(
      marketEntityContentHash({
        phone: '0902222222',
        website: 'https://a.vn',
        company_name: 'Spa A',
        address: 'HCM',
      }),
    ).not.toBe(base);
    expect(
      marketEntityContentHash({
        phone: '0901111111',
        website: 'https://b.vn',
        company_name: 'Spa A',
        address: 'HCM',
      }),
    ).not.toBe(base);
  });

  it('classifies new → updated → unchanged', () => {
    const h1 = marketEntityContentHash({
      phone: '0901',
      website: 'https://a.vn',
      company_name: 'A',
      address: 'x',
    });
    const h2 = marketEntityContentHash({
      phone: '0902',
      website: 'https://a.vn',
      company_name: 'A',
      address: 'x',
    });
    expect(classifyMarketEntityChange(null, h1)).toBe('new');
    expect(classifyMarketEntityChange(h1, h2)).toBe('updated');
    expect(classifyMarketEntityChange(h2, h2)).toBe('unchanged');
  });
});
