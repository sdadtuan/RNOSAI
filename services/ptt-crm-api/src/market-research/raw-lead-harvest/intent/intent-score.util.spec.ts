import { computeIntentScore, isChainDenylistName } from './intent-score.util';

describe('intent-score.util', () => {
  it('flags national beauty chains', () => {
    expect(isChainDenylistName('Hasaki Clinic')).toBe(true);
    expect(isChainDenylistName('Spa Hoa Mi Quan 3')).toBe(false);
  });

  it('scores SME without website high enough for threshold', () => {
    expect(
      computeIntentScore({
        company_name: 'Spa Hoa Mi',
        has_places_phone: true,
        has_website: false,
        website_fetch_ok: false,
        scraped_contact: false,
        ratings_total: 5,
      }),
    ).toBeGreaterThanOrEqual(40);
  });

  it('scores denylist chains below threshold', () => {
    expect(
      computeIntentScore({
        company_name: 'Benh vien tham my Kangnam',
        has_places_phone: true,
        has_website: true,
        website_fetch_ok: true,
        scraped_contact: true,
        ratings_total: 5000,
      }),
    ).toBeLessThan(40);
  });
});
