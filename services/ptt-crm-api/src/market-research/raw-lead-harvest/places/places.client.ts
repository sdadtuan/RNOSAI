/**
 * Google Places (Legacy) Text Search + Place Details.
 * Uses PTT_GOOGLE_PLACES_API_KEY. Prefer official API only — no HTML scrape of Maps.
 */
import type { PlaceCandidate, PlacesTextSearchResult } from './places.types';

type LegacyTextRow = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
};

type LegacyDetails = {
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
  };
  status?: string;
};

function mapTextRow(row: LegacyTextRow): PlaceCandidate | null {
  const placeId = String(row.place_id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!placeId || !name) return null;
  return {
    place_id: placeId,
    company_name: name,
    address: row.formatted_address ? String(row.formatted_address) : null,
    phone: null,
    website: null,
    lat: row.geometry?.location?.lat ?? null,
    lng: row.geometry?.location?.lng ?? null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    user_ratings_total:
      typeof row.user_ratings_total === 'number' ? row.user_ratings_total : null,
    types: Array.isArray(row.types) ? row.types.map(String) : [],
    maps_url: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
  };
}

export class PlacesClient {
  constructor(private readonly apiKey: string) {
    if (!String(apiKey ?? '').trim()) {
      throw new Error('places_not_configured');
    }
  }

  async textSearch(
    query: string,
    opts: { pageToken?: string; language?: string } = {},
  ): Promise<PlacesTextSearchResult> {
    const params = new URLSearchParams({
      query: String(query ?? '').trim(),
      key: this.apiKey,
      language: opts.language ?? 'vi',
    });
    if (opts.pageToken) params.set('pagetoken', opts.pageToken);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      status?: string;
      results?: LegacyTextRow[];
      next_page_token?: string;
      error_message?: string;
    };
    const status = String(body.status ?? (res.ok ? 'UNKNOWN' : `HTTP_${res.status}`));
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      throw new Error(`places_textsearch_${status}${body.error_message ? `:${body.error_message}` : ''}`);
    }
    const results = (body.results ?? [])
      .map((row) => mapTextRow(row))
      .filter((x): x is PlaceCandidate => Boolean(x));
    return {
      results,
      nextPageToken: body.next_page_token ? String(body.next_page_token) : null,
      rawStatus: status,
    };
  }

  async placeDetails(placeId: string): Promise<PlaceCandidate | null> {
    const params = new URLSearchParams({
      place_id: placeId,
      key: this.apiKey,
      language: 'vi',
      fields:
        'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,url,geometry,rating,user_ratings_total,types',
    });
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
    const res = await fetch(url);
    const body = (await res.json()) as LegacyDetails & { error_message?: string };
    const status = String(body.status ?? '');
    if (status !== 'OK' || !body.result) {
      if (status === 'NOT_FOUND' || status === 'ZERO_RESULTS') return null;
      throw new Error(`places_details_${status}${body.error_message ? `:${body.error_message}` : ''}`);
    }
    const r = body.result;
    const id = String(r.place_id ?? placeId).trim();
    const name = String(r.name ?? '').trim();
    if (!id || !name) return null;
    const phone =
      String(r.formatted_phone_number ?? '').trim() ||
      String(r.international_phone_number ?? '').trim() ||
      null;
    return {
      place_id: id,
      company_name: name,
      address: r.formatted_address ? String(r.formatted_address) : null,
      phone,
      website: r.website ? String(r.website).trim() : null,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
      rating: typeof r.rating === 'number' ? r.rating : null,
      user_ratings_total:
        typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
      types: Array.isArray(r.types) ? r.types.map(String) : [],
      maps_url: r.url
        ? String(r.url)
        : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id)}`,
    };
  }
}

/** Test helper — map legacy text row without network. */
export function mapLegacyTextSearchRowForTest(row: LegacyTextRow): PlaceCandidate | null {
  return mapTextRow(row);
}
