import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { CustomersPgRepository } from './customers-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

const customerRow = {
  id: 7,
  name: 'Khách A',
  phone: '0901',
  email: 'a@example.com',
  address: '',
  company: '',
  lead_source: 'other',
  lead_source_note: '',
  date_of_birth: '',
  gender: '',
  id_number: '',
  occupation: '',
  interests: '',
  profile_notes: '',
  created_at: new Date('2026-08-27T00:00:00.000Z'),
};

describe('CustomersModule Wave 1', () => {
  it('wires customers exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'customers.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'customers.module.ts'), 'utf8');

    expect(service).not.toMatch(/CustomersSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/CustomersSqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/CustomersPgRepository/);
    expect(module).toMatch(/CustomersPgRepository/);
  });
});

describe('CustomersPgRepository', () => {
  const query = jest.fn();
  let repo: CustomersPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new CustomersPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('alters crm_customers and creates all satellite tables before listing', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [customerRow] });

    const rows = await repo.listCustomers('Khách', 999);

    expect(query.mock.calls[0][0]).toContain('ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_source');
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_customer_relations');
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_customer_purchases');
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_customer_issues');
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_customer_brief_scans');
    expect(query.mock.calls[1][0]).toContain('ILIKE $1');
    expect(query.mock.calls[1][1]).toEqual(['%Khách%', 500]);
    expect(rows[0]).toMatchObject({
      id: 7,
      lead_source: 'other',
      lead_source_label: 'Khác',
      created_at: '2026-08-27T00:00:00.000Z',
    });
  });

  it('normalizes profile values when creating a customer', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [customerRow] });

    await repo.createCustomer({
      name: '  Khách A  ',
      phone: ' 0901 ',
      lead_source: 'unlisted-source',
      gender: 'unlisted-gender',
    });

    expect(query.mock.calls[1][1]).toEqual([
      'Khách A',
      '0901',
      '',
      '',
      '',
      'other',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      expect.any(String),
    ]);
  });

  it('computes open issue totals with the legacy status rules', () => {
    const stats = repo.computeStats(
      [{} as never],
      [{} as never, {} as never],
      [
        { status: 'moi' } as never,
        { status: 'da_xu_ly' } as never,
        { status: 'dong' } as never,
      ],
    );

    expect(stats).toEqual({
      relations_total: 1,
      purchases_total: 2,
      issues_total: 3,
      issues_open: 1,
    });
  });
});
