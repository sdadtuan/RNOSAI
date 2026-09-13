import {
  CpMagnificFlowCacheService,
  type CpMagnificFlowCacheQueryPort,
} from './cp-magnific-flow-cache.repository';
import type { CpMagnificFlowsAdapter } from './cp-magnific-flows.adapter';

class CacheMemory implements CpMagnificFlowCacheQueryPort {
  rows: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('FROM crm_cp_magnific_flow_cache') && sql.includes('expires_at > now()')) {
      const sqid = String(params[0]);
      const found = this.rows.find((row) =>
        String(row.sqid) === sqid && new Date(String(row.expires_at)).getTime() > Date.now(),
      );
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('INSERT INTO crm_cp_magnific_flow_cache')) {
      const row = {
        sqid: params[0],
        name: params[1],
        inputs_schema_json: JSON.parse(String(params[2])),
        total_cost: params[3],
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + Number(params[4]) * 1000),
      };
      const idx = this.rows.findIndex((item) => String(item.sqid) === String(row.sqid));
      if (idx >= 0) this.rows[idx] = row;
      else this.rows.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

describe('CpMagnificFlowCacheService', () => {
  it('returns a cached row when not expired', async () => {
    const db = new CacheMemory();
    db.rows.push({
      sqid: 'sq1',
      name: 'Social 9:16',
      inputs_schema_json: [{ api_key: 'image_prompt', type: 'text', required: true }],
      total_cost: 5,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const service = new CpMagnificFlowCacheService(db);

    const hit = await service.get('sq1');
    expect(hit?.name).toBe('Social 9:16');
  });

  it('misses when expires_at is in the past', async () => {
    const db = new CacheMemory();
    db.rows.push({
      sqid: 'sq1',
      name: 'Expired',
      inputs_schema_json: [],
      total_cost: null,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const service = new CpMagnificFlowCacheService(db);

    await expect(service.get('sq1')).resolves.toBeNull();
  });

  it('fetches from adapter on miss and upserts', async () => {
    const db = new CacheMemory();
    const flows = {
      getFlow: jest.fn(async () => ({
        sqid: 'sq2',
        name: 'Fresh Flow',
        inputs: [{ api_key: 'motion_prompt', type: 'text', required: true }],
        total_cost: 7,
      })),
    } as unknown as CpMagnificFlowsAdapter;
    const service = new CpMagnificFlowCacheService(db, flows);

    const detail = await service.getOrFetch('sq2');
    expect(detail.name).toBe('Fresh Flow');
    expect(flows.getFlow).toHaveBeenCalledWith('sq2');
    expect(db.rows).toHaveLength(1);
  });
});
