import { Pool } from 'pg';
import { sumReceivedRevenueForRange } from './forecast-actual.util';

describe('forecast-actual.util', () => {
  it('queries received revenue from PostgreSQL with a bounded date range', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ v: '1250000' }] });
    const pool = { query } as unknown as Pool;

    await expect(
      sumReceivedRevenueForRange(pool, '2026-08-01', '2026-08-31'),
    ).resolves.toBe(1_250_000);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('received_on >= $1::date'),
      ['2026-08-01', '2026-08-31'],
    );
  });
});
