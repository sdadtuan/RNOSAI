/**
 * Google Places API (New) — Text Search + Place Details.
 * Base: https://places.googleapis.com
 * Uses PTT_GOOGLE_PLACES_API_KEY. Prefer official API only — no HTML scrape of Maps.
 */
import type { PlaceCandidate, PlacesTextSearchResult } from './places.types';

const PLACES_BASE = 'https://places.googleapis.com/v1';

const TEXT_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.googleMapsUri',
  // Contact fields (Enterprise SKU) — needed when Place Details is skipped/fails.
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'nextPageToken',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'location',
  'rating',
  'userRatingCount',
  'types',
].join(',');

type PlacesNewPlace = {
  id?: string;
  name?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
};

type PlacesApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function placeResourcePath(placeId: string): string {
  const id = String(placeId ?? '').trim();
  if (!id) return '';
  return id.startsWith('places/') ? id : `places/${id}`;
}

function normalizePlaceId(place: PlacesNewPlace, fallback = ''): string {
  const rawId = String(place.id ?? '').trim();
  if (rawId) return rawId.replace(/^places\//, '');
  const name = String(place.name ?? fallback).trim();
  return name.replace(/^places\//, '');
}

function mapNewPlace(place: PlacesNewPlace): PlaceCandidate | null {
  const placeId = normalizePlaceId(place);
  const name = String(place.displayName?.text ?? '').trim();
  if (!placeId || !name) return null;
  const phone =
    String(place.nationalPhoneNumber ?? '').trim() ||
    String(place.internationalPhoneNumber ?? '').trim() ||
    null;
  return {
    place_id: placeId,
    company_name: name,
    address: place.formattedAddress ? String(place.formattedAddress) : null,
    phone,
    website: place.websiteUri ? String(place.websiteUri).trim() : null,
    lat: typeof place.location?.latitude === 'number' ? place.location.latitude : null,
    lng: typeof place.location?.longitude === 'number' ? place.location.longitude : null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    user_ratings_total:
      typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    types: Array.isArray(place.types) ? place.types.map(String) : [],
    maps_url: place.googleMapsUri
      ? String(place.googleMapsUri)
      : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
  };
}

function formatPlacesHttpError(status: number, body: PlacesApiErrorBody): string {
  const code = body.error?.status || `HTTP_${status}`;
  const msg = body.error?.message ? `:${body.error.message}` : '';
  return `${code}${msg}`;
}

export class PlacesClient {
  constructor(private readonly apiKey: string) {
    if (!String(apiKey ?? '').trim()) {
      throw new Error('places_not_configured');
    }
  }

  private headers(fieldMask: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': fieldMask,
    };
  }

  async textSearch(
    query: string,
    opts: { pageToken?: string; language?: string } = {},
  ): Promise<PlacesTextSearchResult> {
    const textQuery = String(query ?? '').trim();
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: opts.language ?? 'vi',
      pageSize: 20,
    };
    if (opts.pageToken) body.pageToken = opts.pageToken;

    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: this.headers(TEXT_SEARCH_FIELD_MASK),
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as PlacesApiErrorBody & {
      places?: PlacesNewPlace[];
      nextPageToken?: string;
    };

    if (!res.ok) {
      throw new Error(`places_textsearch_${formatPlacesHttpError(res.status, json)}`);
    }

    const results = (json.places ?? [])
      .map((row) => mapNewPlace(row))
      .filter((x): x is PlaceCandidate => Boolean(x));

    return {
      results,
      nextPageToken: json.nextPageToken ? String(json.nextPageToken) : null,
      rawStatus: results.length ? 'OK' : 'ZERO_RESULTS',
    };
  }

  async placeDetails(placeId: string): Promise<PlaceCandidate | null> {
    const resource = placeResourcePath(placeId);
    if (!resource) return null;

    const res = await fetch(`${PLACES_BASE}/${resource}`, {
      method: 'GET',
      headers: this.headers(DETAILS_FIELD_MASK),
    });
    const json = (await res.json()) as PlacesApiErrorBody & PlacesNewPlace;

    if (res.status === 404) return null;
    if (!res.ok) {
      const status = json.error?.status ?? '';
      if (status === 'NOT_FOUND') return null;
      throw new Error(`places_details_${formatPlacesHttpError(res.status, json)}`);
    }

    return mapNewPlace(json);
  }
}

/** Test helper — map Places API (New) place without network. */
export function mapPlacesNewPlaceForTest(place: PlacesNewPlace): PlaceCandidate | null {
  return mapNewPlace(place);
}

/** @deprecated Use mapPlacesNewPlaceForTest — kept for older specs. */
export function mapLegacyTextSearchRowForTest(row: {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}): PlaceCandidate | null {
  return mapNewPlace({
    id: row.place_id,
    displayName: { text: row.name },
    formattedAddress: row.formatted_address,
    location:
      row.geometry?.location?.lat != null && row.geometry?.location?.lng != null
        ? { latitude: row.geometry.location.lat, longitude: row.geometry.location.lng }
        : undefined,
    rating: row.rating,
    userRatingCount: row.user_ratings_total,
    types: row.types,
  });
}
