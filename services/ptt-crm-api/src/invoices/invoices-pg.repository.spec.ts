import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { InvoicesPgRepository } from './invoices-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('InvoicesModule Wave 1', () => {
  it('wires invoices and order lookups exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'invoices.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'invoices.module.ts'), 'utf8');

    expect(service).not.toMatch(/SqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/SqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/InvoicesPgRepository/);
    expect(service).toMatch(/OrdersPgRepository/);
    expect(module).toMatch(/InvoicesPgRepository/);
  });
});

describe('InvoicesPgRepository', () => {
  const query = jest.fn();
  let repo: InvoicesPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new InvoicesPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates invoice tables before listing and uses PostgreSQL parameters', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 5,
          invoice_number: 'INV-2026-00005',
          order_id: 4,
          contract_id: null,
          lifecycle_id: null,
          customer_id: 7,
          status: 'draft',
          issued_on: '',
          due_on: '2026-09-30',
          amount_vnd: 1_000_000,
          paid_vnd: 0,
          notes: '',
          created_at: '2026-08-27 08:00:00',
          updated_at: '2026-08-27 08:00:00',
        }],
      });

    const rows = await repo.list({ customerId: 7, limit: 999 });

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_invoices');
    expect(schema).toContain('order_id INTEGER');
    expect(schema).toContain('amount_vnd INTEGER NOT NULL DEFAULT 0');
    expect(schema).toContain("to_regclass('public.crm_svc_payments')");
    expect(query.mock.calls[1][0]).toContain('customer_id = $1');
    expect(query.mock.calls[1][1]).toEqual([7, 200]);
    expect(rows[0]).toMatchObject({ id: 5, order_id: 4, paid_vnd: 0 });
  });
});
