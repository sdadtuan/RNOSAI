import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { CrmConfigPgRepository } from './crm-config-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('CrmConfigModule Wave 1', () => {
  it('wires CRM config exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'crm-config.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'crm-config.module.ts'), 'utf8');

    expect(service).not.toMatch(/CrmConfigSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/CrmConfigSqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/CrmConfigPgRepository/);
    expect(module).toMatch(/CrmConfigPgRepository/);
  });
});

describe('CrmConfigPgRepository', () => {
  const query = jest.fn();
  let repo: CrmConfigPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      connect: jest.fn(),
      end: jest.fn(),
    }));
    repo = new CrmConfigPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates and seeds the three PostgreSQL config tables before listing lookups', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: '7',
          kind: 'source',
          option_key: 'website',
          label: 'Website',
          sort_order: 0,
          active: true,
          created_at: new Date('2026-08-27T08:00:00.000Z'),
          updated_at: new Date('2026-08-27T08:00:00.000Z'),
        }],
      });

    const rows = await repo.listLeadLookups('source', true);

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_custom_field_defs');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_pipeline_stages');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_lead_lookup_options');
    expect(query.mock.calls[3][0]).toContain('kind = $1');
    expect(query.mock.calls[3][0]).toContain('active IS TRUE');
    expect(query.mock.calls[3][1]).toEqual(['source']);
    expect(rows[0]).toEqual({
      id: 7,
      kind: 'source',
      option_key: 'website',
      label: 'Website',
      sort_order: 0,
      active: true,
      created_at: '2026-08-27T08:00:00.000Z',
      updated_at: '2026-08-27T08:00:00.000Z',
    });
  });

  it('creates industry lookups and lists them by kind', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema CREATE
      .mockResolvedValueOnce({ rows: [] }) // pipeline seed
      .mockResolvedValueOnce({ rows: [] }) // lookup seed
      .mockResolvedValueOnce({
        rows: [{
          id: '11',
          kind: 'industry',
          option_key: 'spa',
          label: 'Spa / Làm đẹp',
          sort_order: 0,
          active: true,
          created_at: new Date('2026-09-14T08:00:00.000Z'),
          updated_at: new Date('2026-09-14T08:00:00.000Z'),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: '11',
          kind: 'industry',
          option_key: 'spa',
          label: 'Spa / Làm đẹp',
          sort_order: 0,
          active: true,
          created_at: new Date('2026-09-14T08:00:00.000Z'),
          updated_at: new Date('2026-09-14T08:00:00.000Z'),
        }],
      });

    const created = await repo.createLeadLookup({
      kind: 'industry',
      option_key: 'spa',
      label: 'Spa / Làm đẹp',
      sort_order: 0,
    });
    expect(created.kind).toBe('industry');
    expect(created.option_key).toBe('spa');

    const rows = await repo.listLeadLookups('industry', true);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('industry');
  });

  it('seeds industry, job_title, and harvest sources in ensureSchema lookup insert', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await repo.listLeadLookups('industry');

    const seedSql = String(query.mock.calls[2][0]);
    const seedParams = query.mock.calls[2][1] as unknown[];
    expect(seedSql).toContain('INSERT INTO crm_lead_lookup_options');
    expect(seedParams).toEqual(expect.arrayContaining(['industry', 'spa', 'Spa / Làm đẹp', 0]));
    expect(seedParams).toEqual(expect.arrayContaining(['job_title', 'owner', 'Chủ DN / Owner', 0]));
    expect(seedParams).toEqual(expect.arrayContaining(['source', 'google_maps', 'Google Maps', expect.any(Number)]));
  });

  it('stores custom-field options as JSONB and returns the unchanged API shape', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          entity_type: 'lead',
          field_key: 'segment',
          label: 'Phân khúc',
          field_type: 'select',
          options_json: ['SME', 'Enterprise'],
          required: true,
          sort_order: 3,
          active: true,
          created_at: new Date('2026-08-27T08:00:00.000Z'),
          updated_at: new Date('2026-08-27T08:00:00.000Z'),
        }],
      });

    const field = await repo.createCustomField({
      entity_type: 'lead',
      field_key: 'segment',
      label: 'Phân khúc',
      field_type: 'select',
      options: ['SME', 'Enterprise'],
      required: true,
      sort_order: 3,
    });

    expect(query.mock.calls[3][0]).toContain('$5::jsonb');
    expect(query.mock.calls[3][1][4]).toBe('["SME","Enterprise"]');
    expect(field.options).toEqual(['SME', 'Enterprise']);
    expect(field.required).toBe(true);
  });
});
