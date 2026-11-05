import { IntentHarvestWorker } from './intent-harvest.worker';
import type { PlaceCandidate } from '../places/places.types';
import type { RawLeadHarvestJobRow } from '../raw-lead-harvest.types';

function job(over: Partial<RawLeadHarvestJobRow> = {}): RawLeadHarvestJobRow {
  return {
    id: 1,
    project_id: 9,
    industry_key: 'spa',
    industry_label: 'Spa',
    job_title_key: 'all',
    job_title_label: 'Tất cả',
    province_code: '79',
    province_name: 'Hồ Chí Minh',
    ward_code: null,
    ward_name: null,
    sources_json: [{ key: 'google_maps', label: 'Google Maps' }],
    channels_json: [],
    provider: 'google_places',
    model: '',
    mode: 'intent',
    cross_check: false,
    target_count: 2,
    scan_cap: 10,
    notes: null,
    status: 'running',
    error_message: null,
    result_count: 0,
    rejected_by_gate_count: 0,
    stats_json: null,
    created_by_staff_id: 1,
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    ...over,
  };
}

function place(over: Partial<PlaceCandidate>): PlaceCandidate {
  return {
    place_id: 'p1',
    company_name: 'Spa Hoa Mi',
    address: 'Q3, HCM',
    phone: '0909479018',
    website: 'https://spa-hoa-mi.example',
    lat: 10.7,
    lng: 106.6,
    rating: 4,
    user_ratings_total: 8,
    types: ['spa'],
    maps_url: 'https://maps.google.com/?q=place_id:p1',
    ...over,
  };
}

describe('IntentHarvestWorker', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('inserts all places including CRM/blacklist; skips existing place_id only', async () => {
    const inserted: Array<{
      company_name: string;
      place_id?: string | null;
      readiness_status?: string | null;
      status?: string;
    }> = [];
    const knownPlaces = new Set(['already']);
    const repo = {
      listDedupeKeys: jest.fn(async () => []),
      listBlacklistEntries: jest.fn(async () => [
        { kind: 'company_norm' as const, value_norm: 'hasaki' },
      ]),
      findAlreadyCustomerByPhone: jest.fn(async (phone: string) =>
        phone.includes('111'),
      ),
      hasRecentAcceptedOrPushed: jest.fn(async () => false),
      hasPlaceIdInProject: jest.fn(async (_pid: number, placeId: string) =>
        knownPlaces.has(placeId),
      ),
      hasDuplicatePhoneInProject: jest.fn(async () => false),
      insertLead: jest.fn(async (row: (typeof inserted)[number]) => {
        inserted.push(row);
        if (row.place_id) knownPlaces.add(row.place_id);
        return row;
      }),
    };

    const places = {
      textSearch: jest.fn(async () => ({
        results: [
          place({ place_id: 'already', company_name: 'Spa Old', phone: '0909999999' }),
          place({ place_id: 'chain', company_name: 'Hasaki', phone: '02811112222' }),
          place({ place_id: 'crm', company_name: 'Spa CRM', phone: '0901111111' }),
          place({ place_id: 'good', company_name: 'Spa Hoa Mi', phone: '0909479018' }),
          place({
            place_id: 'nophone',
            company_name: 'Spa No Phone',
            phone: null,
            website: null,
          }),
        ],
        nextPageToken: null,
        rawStatus: 'OK',
      })),
      placeDetails: jest.fn(async (id: string) => {
        if (id === 'already')
          return place({ place_id: 'already', company_name: 'Spa Old', phone: '0909999999' });
        if (id === 'chain')
          return place({ place_id: 'chain', company_name: 'Hasaki', phone: '02811112222' });
        if (id === 'crm')
          return place({ place_id: 'crm', company_name: 'Spa CRM', phone: '0901111111' });
        if (id === 'nophone')
          return place({
            place_id: 'nophone',
            company_name: 'Spa No Phone',
            phone: null,
            website: null,
          });
        return place({ place_id: 'good', company_name: 'Spa Hoa Mi', phone: '0909479018' });
      }),
    };

    const worker = new IntentHarvestWorker(repo as never);
    const out = await worker.run(job({ ward_code: '1', ward_name: 'Test' }), places as never, {
      maxSearchRequests: 5,
      maxDetailsRequests: 20,
    });

    expect(out.stats.skipped_place_id).toBeGreaterThanOrEqual(1);
    expect(inserted.length).toBeGreaterThanOrEqual(3);
    expect(inserted.every((row) => row.status === 'pending')).toBe(true);
    expect(inserted.some((row) => row.company_name.includes('Hasaki'))).toBe(true);
    expect(inserted.some((row) => row.company_name.includes('CRM'))).toBe(true);
    expect(inserted.some((row) => row.company_name.includes('Hoa Mi'))).toBe(true);
    expect(out.stats.inserted).toBe(inserted.length);
    expect(
      out.stats.ready_to_push +
        out.stats.needs_review +
        out.stats.missing_contact +
        out.stats.duplicate_or_blacklist,
    ).toBe(inserted.length);
  });
});
