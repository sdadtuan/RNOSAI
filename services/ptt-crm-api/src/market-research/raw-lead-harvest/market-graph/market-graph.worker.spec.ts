import { MarketGraphWorker } from './market-graph.worker';
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
    province_code: '01',
    province_name: 'Hà Nội',
    ward_code: null,
    ward_name: null,
    sources_json: [{ key: 'google_maps', label: 'Google Maps' }],
    channels_json: [],
    provider: 'google_places',
    model: '',
    mode: 'market_graph',
    cross_check: false,
    target_count: 5,
    scan_cap: 20,
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
    address: 'HN',
    phone: '0909479018',
    website: 'https://spa-hoa-mi.example',
    lat: 21,
    lng: 105,
    rating: 4,
    user_ratings_total: 8,
    types: ['spa'],
    maps_url: 'https://maps.google.com/?q=place_id:p1',
    ...over,
  };
}

describe('MarketGraphWorker', () => {
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

  it('inserts only new/updated census diffs and skips unchanged', async () => {
    const inserted: unknown[] = [];
    const repo = {
      listDedupeKeys: jest.fn(async () => []),
      listBlacklistEntries: jest.fn(async () => []),
      findAlreadyCustomerByPhone: jest.fn(async () => false),
      hasRecentAcceptedOrPushed: jest.fn(async () => false),
      insertLead: jest.fn(async (row: unknown) => {
        inserted.push(row);
        return row;
      }),
    };

    const changes = new Map<string, 'new' | 'updated' | 'unchanged'>([
      ['new1', 'new'],
      ['upd1', 'updated'],
      ['same1', 'unchanged'],
    ]);

    const marketEntities = {
      upsertFromPlace: jest.fn(async (input: { place_id: string }) => ({
        entity_id: `ent-${input.place_id}`,
        change: changes.get(input.place_id) ?? 'new',
      })),
    };

    const places = {
      textSearch: jest.fn(async () => ({
        results: [
          place({ place_id: 'new1', company_name: 'Spa New' }),
          place({ place_id: 'upd1', company_name: 'Spa Updated', phone: '0902222222' }),
          place({ place_id: 'same1', company_name: 'Spa Same', phone: '0903333333' }),
        ],
        nextPageToken: null,
        rawStatus: 'OK',
      })),
      placeDetails: jest.fn(async (id: string) => {
        if (id === 'upd1') return place({ place_id: 'upd1', company_name: 'Spa Updated', phone: '0902222222' });
        if (id === 'same1') return place({ place_id: 'same1', company_name: 'Spa Same', phone: '0903333333' });
        return place({ place_id: 'new1', company_name: 'Spa New' });
      }),
    };

    const worker = new MarketGraphWorker(repo as never, marketEntities as never);
    const out = await worker.run(job(), places as never, { maxPlacesRequests: 20 });

    expect(out.stats.census_new).toBe(1);
    expect(out.stats.census_updated).toBe(1);
    expect(out.stats.census_unchanged).toBe(1);
    expect(out.stats.skipped_unchanged).toBe(1);
    expect(inserted.length).toBe(2);
    expect(
      inserted.every((row) =>
        ['ent-new1', 'ent-upd1'].includes(String((row as { market_entity_id: string }).market_entity_id)),
      ),
    ).toBe(true);
    expect(inserted.some((row) => String((row as { company_name: string }).company_name).includes('Same'))).toBe(
      false,
    );
  });
});
