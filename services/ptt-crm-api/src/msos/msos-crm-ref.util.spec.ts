import { UnprocessableEntityException } from '@nestjs/common';
import { requireClient, requireCreative, requireLead } from './msos-crm-ref.util';

describe('msos-crm-ref.util', () => {
  it('422 when client missing and never inserts', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }), sqls: [] as string[] };
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      return { rows: [] };
    });
    await expect(requireClient(db, '00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({
      status: 422,
      response: { error: 'client_not_found' },
    });
    expect(db.sqls.join(' ')).toMatch(/SELECT/i);
    expect(db.sqls.join(' ')).toMatch(/FROM clients/i);
    expect(db.sqls.join(' ')).not.toMatch(/INSERT/i);
  });

  it('passes when client exists', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '00000000-0000-4000-8000-000000000001' }] }),
    };
    await expect(requireClient(db, '00000000-0000-4000-8000-000000000001')).resolves.toBeUndefined();
  });

  it('422 when lead missing and never inserts', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }), sqls: [] as string[] };
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      return { rows: [] };
    });
    await expect(requireLead(db, '00000000-0000-4000-8000-000000000002')).rejects.toMatchObject({
      status: 422,
      response: { error: 'lead_not_found' },
    });
    expect(db.sqls.join(' ')).toMatch(/FROM leads/i);
    expect(db.sqls.join(' ')).not.toMatch(/INSERT/i);
  });

  it('422 when creative missing and never inserts', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }), sqls: [] as string[] };
    db.query.mockImplementation(async (sql: string) => {
      db.sqls.push(sql);
      return { rows: [] };
    });
    await expect(requireCreative(db, '00000000-0000-4000-8000-000000000003')).rejects.toMatchObject({
      status: 422,
      response: { error: 'creative_not_found' },
    });
    expect(db.sqls.join(' ')).toMatch(/FROM crm_cp_assets/i);
    expect(db.sqls.join(' ')).not.toMatch(/INSERT/i);
  });

  it('throws UnprocessableEntityException type', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(requireClient(db, '00000000-0000-4000-8000-000000000001')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
