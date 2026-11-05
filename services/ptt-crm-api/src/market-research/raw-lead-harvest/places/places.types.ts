export type PlaceCandidate = {
  place_id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  maps_url: string | null;
};

export type PlacesTextSearchResult = {
  results: PlaceCandidate[];
  nextPageToken: string | null;
  rawStatus: string;
};
