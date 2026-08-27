import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { OrdersPgRepository } from './orders-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('OrdersModule Wave 1', () => {
  it('wires orders exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'orders.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'orders.module.ts'), 'utf8');

    expect(service).not.toMatch(/OrdersSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/OrdersSqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/OrdersPgRepository/);
    expect(module).toMatch(/OrdersPgRepository/);
  });
});

describe('OrdersPgRepository', () => {
  const query = jest.fn();
  let repo: OrdersPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new OrdersPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates the PostgreSQL billing schema before listing orders', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 4,
          reference_code: 'SO-2026-00004',
          customer_id: 7,
          contract_id: null,
          proposal_id: null,
          lifecycle_id: null,
          lead_id: null,
          status: 'draft',
          order_date: '2026-08-27',
          total_vnd: 1_000_000,
          billing_type: 'one_off',
          notes: '',
          created_at: '2026-08-27 08:00:00',
          updated_at: '2026-08-27 08:00:00',
        }],
      });

    const rows = await repo.list({ customerId: 7, status: 'draft', limit: 999 });

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_orders');
    expect(schema).toContain('id SERIAL PRIMARY KEY');
    expect(schema).toContain('total_vnd INTEGER NOT NULL DEFAULT 0');
    expect(query.mock.calls[1][0]).toContain('customer_id = $1');
    expect(query.mock.calls[1][0]).toContain('status = $2');
    expect(query.mock.calls[1][1]).toEqual([7, 'draft', 200]);
    expect(rows[0]).toMatchObject({ id: 4, total_vnd: 1_000_000 });
  });
});
