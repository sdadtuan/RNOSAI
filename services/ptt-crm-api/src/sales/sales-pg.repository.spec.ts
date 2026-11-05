import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { SalesPgRepository } from './sales-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('SalesModule Wave 1', () => {
  it('wires sales exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'sales.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'sales.module.ts'), 'utf8');

    expect(service).not.toMatch(/SalesSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/SalesSqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/SalesPgRepository/);
    expect(module).toMatch(/SalesPgRepository/);
  });
});

describe('SalesPgRepository', () => {
  const query = jest.fn();
  let repo: SalesPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new SalesPgRepository(
      { databaseUrl: 'postgres://test' } as never,
      {
        toPipelineRuntime: jest.fn(),
        getSalesPipelineConfig: jest.fn(),
      } as never,
    );
  });

  it('creates the PostgreSQL sales schema before listing plans', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: '4',
          title: 'Kế hoạch 2026',
          fiscal_year: 2026,
          period_start: '2026-01-01',
          period_end: '2026-12-31',
          revenue_target_vnd: '1200000000',
          status: 'active',
          summary: '',
          strategy_notes: '',
          created_at: new Date('2026-08-27T08:00:00.000Z'),
          updated_at: new Date('2026-08-27T08:00:00.000Z'),
        }],
      });

    const rows = await repo.listPlans();

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_plans');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_targets');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_partners');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_trainings');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_market_research');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_sales_transactions');
    expect(query.mock.calls[1][0]).toContain(
      'ORDER BY fiscal_year DESC, id DESC',
    );
    expect(rows[0]).toMatchObject({
      id: 4,
      revenue_target_vnd: 1_200_000_000,
      status_label: 'Đang triển khai',
      created_at: '2026-08-27T08:00:00.000Z',
    });
  });

  it('uses PostgreSQL parameters for partner search', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await repo.listPartners('An');

    expect(query.mock.calls[1][0]).toContain('ILIKE $1');
    expect(query.mock.calls[1][1]).toEqual(['%An%']);
  });
});
