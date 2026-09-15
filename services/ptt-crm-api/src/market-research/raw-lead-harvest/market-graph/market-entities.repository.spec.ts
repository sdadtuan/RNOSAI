import { MarketEntitiesRepository } from './market-entities.repository';
import { marketEntityContentHash } from './market-content-hash.util';
import type { PlaceCandidate } from '../places/places.types';

function place(over: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    place_id: 'ChIJ1',
    company_name: 'Spa Hoa Mi',
    address: 'Q3, HCM',
    phone: '0909479018',
    website: 'https://spa.example',
    lat: 10.7,
    lng: 106.6,
    rating: 4,
    user_ratings_total: 8,
    types: ['spa'],
    maps_url: 'https://maps.google.com/?q=place_id:ChIJ1',
    ...over,
  };
}

describe('MarketEntitiesRepository', () => {
  it('upserts new → updated → unchanged via SQL flow', async () => {
    const store = new Map<string, { id: string; content_hash: string }>();
    let seq = 0;

    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, ' ');
      if (s.includes('CREATE TABLE') || s.includes('ALTER TABLE') || s.includes('CREATE INDEX')) {
        return { rows: [] };
      }
      if (s.includes('FROM crm_research_market_entities') && s.includes('SELECT id')) {
        const key = `${params[0]}|${params[1]}|${params[2]}`;
        const row = store.get(key);
        return { rows: row ? [{ id: row.id, content_hash: row.content_hash }] : [] };
      }
      if (s.includes('INSERT INTO crm_research_market_entities')) {
        seq += 1;
        const id = `uuid-${seq}`;
        const key = `${params[0]}|${params[1]}|${params[2]}`;
        const contentHash = String(params[13]);
        store.set(key, { id, content_hash: contentHash });
        return { rows: [{ id }] };
      }
      if (s.includes('UPDATE crm_research_market_entities')) {
        const id = String(params[11]);
        const contentHash = String(params[10]);
        for (const [k, v] of store.entries()) {
          if (v.id === id) store.set(k, { id, content_hash: contentHash });
        }
        return { rows: [] };
      }
      if (s.includes('COUNT(*)')) {
        return {
          rows: [{ total: store.size, with_phone: store.size, last_seen_at: new Date() }],
        };
      }
      return { rows: [] };
    });

    const repo = new MarketEntitiesRepository({ databaseUrl: 'postgres://x' } as never);
    Object.defineProperty(repo, 'db', { get: () => ({ query }) });

    const base = place();
    const first = await repo.upsertFromPlace({
      ...base,
      industry_key: 'spa',
      province_code: '79',
    });
    expect(first.change).toBe('new');
    expect(first.entity_id).toBeTruthy();

    const second = await repo.upsertFromPlace({
      ...base,
      phone: '0901111222',
      industry_key: 'spa',
      province_code: '79',
    });
    expect(second.change).toBe('updated');
    expect(second.entity_id).toBe(first.entity_id);

    const third = await repo.upsertFromPlace({
      ...base,
      phone: '0901111222',
      industry_key: 'spa',
      province_code: '79',
    });
    expect(third.change).toBe('unchanged');
    expect(third.entity_id).toBe(first.entity_id);

    const summary = await repo.listSummary('spa', '79');
    expect(summary.total).toBe(1);
    expect(summary.with_phone).toBe(1);
    expect(summary.last_seen_at).toBeTruthy();

    const expectedHash = marketEntityContentHash({
      phone: '0901111222',
      website: base.website,
      company_name: base.company_name,
      address: base.address,
    });
    expect(store.get('spa|79|ChIJ1')?.content_hash).toBe(expectedHash);
  });
});
