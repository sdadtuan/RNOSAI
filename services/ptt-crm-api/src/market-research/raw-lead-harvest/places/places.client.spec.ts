import { mapLegacyTextSearchRowForTest, PlacesClient } from './places.client';

describe('places.client', () => {
  it('throws when api key missing', () => {
    expect(() => new PlacesClient('')).toThrow('places_not_configured');
  });

  it('maps a legacy text-search row', () => {
    const out = mapLegacyTextSearchRowForTest({
      place_id: 'ChIJabc',
      name: 'Spa Hoa Mi',
      formatted_address: 'Quan 3, HCM',
      geometry: { location: { lat: 10.7, lng: 106.6 } },
      rating: 4.5,
      user_ratings_total: 12,
      types: ['spa', 'point_of_interest'],
    });
    expect(out).toEqual(
      expect.objectContaining({
        place_id: 'ChIJabc',
        company_name: 'Spa Hoa Mi',
        phone: null,
        maps_url: expect.stringContaining('place_id:ChIJabc'),
      }),
    );
  });
});
