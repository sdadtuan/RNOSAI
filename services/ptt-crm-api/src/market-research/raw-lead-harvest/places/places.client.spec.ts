import {
  mapLegacyTextSearchRowForTest,
  mapPlacesNewPlaceForTest,
  PlacesClient,
} from './places.client';

describe('places.client', () => {
  it('throws when api key missing', () => {
    expect(() => new PlacesClient('')).toThrow('places_not_configured');
  });

  it('maps a Places API (New) place', () => {
    const out = mapPlacesNewPlaceForTest({
      id: 'ChIJabc',
      name: 'places/ChIJabc',
      displayName: { text: 'Spa Hoa Mi' },
      formattedAddress: 'Quan 3, HCM',
      location: { latitude: 10.7, longitude: 106.6 },
      rating: 4.5,
      userRatingCount: 12,
      types: ['spa', 'point_of_interest'],
      googleMapsUri: 'https://maps.google.com/?cid=1',
      nationalPhoneNumber: '0901',
      websiteUri: 'https://example.com',
    });
    expect(out).toEqual(
      expect.objectContaining({
        place_id: 'ChIJabc',
        company_name: 'Spa Hoa Mi',
        phone: '0901',
        website: 'https://example.com',
        maps_url: 'https://maps.google.com/?cid=1',
      }),
    );
  });

  it('still maps legacy-shaped rows via compat helper', () => {
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

  it('calls places.googleapis.com searchText', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        places: [
          {
            id: 'ChIJ1',
            displayName: { text: 'Cafe A' },
            formattedAddress: 'HN',
          },
        ],
        nextPageToken: 'tok2',
      }),
    }));
    const prev = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new PlacesClient('test-key');
      const out = await client.textSearch('cafe ha noi');
      expect(out.results[0]?.company_name).toBe('Cafe A');
      expect(out.nextPageToken).toBe('tok2');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://places.googleapis.com/v1/places:searchText',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-key',
          }),
        }),
      );
    } finally {
      global.fetch = prev;
    }
  });
});
