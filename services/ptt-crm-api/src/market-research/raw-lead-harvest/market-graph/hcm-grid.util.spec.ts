import { buildMarketGraphQueries, HCM_MARKET_GRID, isHcmProvince } from './hcm-grid.util';

describe('hcm-grid.util', () => {
  it('detects HCM by code 79', () => {
    expect(isHcmProvince('79', 'Anything')).toBe(true);
    expect(isHcmProvince('01', 'Hà Nội')).toBe(false);
  });

  it('expands HCM into district grid queries', () => {
    const qs = buildMarketGraphQueries({
      industry_label: 'Spa',
      province_code: '79',
      province_name: 'Hồ Chí Minh',
    });
    expect(qs.length).toBe(HCM_MARKET_GRID.length);
    expect(qs[0]).toContain('Quận 1');
    expect(qs.every((q) => q.startsWith('Spa '))).toBe(true);
  });

  it('uses single query for non-HCM and ward override', () => {
    expect(
      buildMarketGraphQueries({
        industry_label: 'Spa',
        province_code: '01',
        province_name: 'Hà Nội',
      }),
    ).toEqual(['Spa Hà Nội']);
    expect(
      buildMarketGraphQueries({
        industry_label: 'Spa',
        province_code: '79',
        province_name: 'Hồ Chí Minh',
        ward_name: 'Bến Nghé',
      }),
    ).toEqual(['Spa Bến Nghé Hồ Chí Minh']);
  });
});
