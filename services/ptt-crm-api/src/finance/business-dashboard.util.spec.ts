import { Pool } from 'pg';
import {
  buildExecutiveWeekBuckets,
  getAttributionDrillPaths,
  getExecutiveWeeklyTrends,
  resolveExecutiveAnchorYmd,
} from './business-dashboard.util';

function poolWithRows(): Pool {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('information_schema.tables')) return { rows: [{ ok: true }] };
    if (sql.includes('SUM(amount_vnd)')) return { rows: [{ v: '150000' }] };
    if (sql.includes('COUNT(*)') && sql.includes('created_at::date')) return { rows: [{ v: '1' }] };
    if (sql.includes('GROUP BY campaign_key')) {
      return { rows: [{ campaign_key: 'meta-summer', lead_count: '2', sample_lead_id: 43 }] };
    }
    if (sql.includes('SELECT full_name')) return { rows: [{ full_name: 'Lead Y' }] };
    return { rows: [] };
  });
  return { query } as unknown as Pool;
}

describe('business-dashboard.util', () => {
  it('resolveExecutiveAnchorYmd caps at month end', () => {
    expect(resolveExecutiveAnchorYmd(2026, 7, '2026-07-26')).toBe('2026-07-26');
    expect(resolveExecutiveAnchorYmd(2026, 6, '2026-07-26')).toBe('2026-06-30');
  });

  it('buildExecutiveWeekBuckets returns 12 weekly labels', () => {
    const buckets = buildExecutiveWeekBuckets('2026-07-26', 12);
    expect(buckets).toHaveLength(12);
    expect(buckets[0]?.start <= buckets[0]?.end).toBe(true);
    expect(buckets[11]?.end).toBe('2026-07-26');
  });

  it('getExecutiveWeeklyTrends aggregates revenue and leads through PostgreSQL', async () => {
    const out = await getExecutiveWeeklyTrends(poolWithRows(), 2026, 7, 12);
    expect(out.weeks).toBe(12);
    expect(Array.isArray(out.labels)).toBe(true);
    expect((out.revenue_vnd as number[]).some((v) => v > 0)).toBe(true);
    expect((out.leads as number[]).some((v) => v > 0)).toBe(true);
  });

  it('getAttributionDrillPaths returns hub and lead hrefs from PostgreSQL', async () => {
    const out = await getAttributionDrillPaths(poolWithRows(), 2026, 7, 5);
    expect(out.count).toBe(1);
    const row = (out.rows as Array<Record<string, unknown>>)[0];
    expect(row?.lead_count).toBe(2);
    expect(row?.hub_href).toBe('/crm/hub?campaign_id=meta-summer');
    expect(row?.lead_href).toBe('/crm/leads/43');
  });
});
