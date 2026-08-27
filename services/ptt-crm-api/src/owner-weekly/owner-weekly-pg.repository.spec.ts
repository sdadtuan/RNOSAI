import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { OwnerWeeklyPgRepository } from './owner-weekly-pg.repository';
import { OwnerWeeklyService } from './owner-weekly.service';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('Owner weekly Wave 1 wiring', () => {
  it('uses PostgreSQL exclusively and stays separate from ops weekly', () => {
    const service = fs.readFileSync(path.join(__dirname, 'owner-weekly.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'owner-weekly.module.ts'), 'utf8');

    for (const source of [service, module]) {
      expect(source).not.toMatch(/OwnerWeeklySqliteRepository|owner-weekly-sqlite|DatabaseSync|sqlitePath/);
      expect(source).toMatch(/OwnerWeeklyPgRepository/);
      expect(source).not.toMatch(/OpsWeeklyPgRepository|ops-weekly-pg/);
    }
  });
});

describe('OwnerWeeklyPgRepository', () => {
  const query = jest.fn();
  let repo: OwnerWeeklyPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new OwnerWeeklyPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates the cash snapshot schema and lists snapshots with the existing DTO', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: '7',
          snapshot_on: '2026-08-24',
          balance_vnd: '125000000',
          source: 'bank',
          notes: 'Đối soát',
          updated_at: new Date('2026-08-24T08:30:00.000Z'),
        }],
      });

    const result = await repo.listCashSnapshots(12);

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_owner_cash_snapshots');
    expect(schema).toContain('UNIQUE');
    expect(query.mock.calls[1][0]).toContain('LIMIT $1');
    expect(query.mock.calls[1][1]).toEqual([12]);
    expect(result).toEqual({
      snapshots: [{
        id: 7,
        snapshot_on: '2026-08-24',
        balance_vnd: 125000000,
        source: 'bank',
        notes: 'Đối soát',
        updated_at: '2026-08-24T08:30:00.000Z',
      }],
    });
  });

  it('upserts a normalized cash snapshot with PostgreSQL conflict handling', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 3,
          snapshot_on: '2026-08-25',
          balance_vnd: '42000000',
          source: 'manual',
          notes: 'closing',
          updated_at: '2026-08-25T10:00:00.000Z',
        }],
      });

    const result = await repo.upsertCashSnapshot('2026-08-25', 42000000.9, 'invalid', ' closing ');

    expect(query.mock.calls[1][0]).toContain('ON CONFLICT (snapshot_on) DO UPDATE');
    expect(query.mock.calls[1][0]).toContain('RETURNING');
    expect(query.mock.calls[1][1]).toEqual(['2026-08-25', 42000000, 'manual', 'closing']);
    expect(result).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        id: 3,
        balance_vnd: 42000000,
        source: 'manual',
      }),
    });
  });

  it('deletes snapshots by date and reports whether a row changed', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await expect(repo.deleteCashSnapshot('2026-08-25')).resolves.toEqual({
      ok: true,
      deleted: true,
    });
    expect(query.mock.calls[1][1]).toEqual(['2026-08-25']);
  });

  it('keeps repository date validation mapped to the existing bad-request response', async () => {
    const service = new OwnerWeeklyService(repo);

    await expect(service.upsertCashSnapshot({
      snapshot_on: '2026-02-30',
      balance_vnd: 1,
    })).rejects.toMatchObject({
      response: { error: 'snapshot_on không hợp lệ (YYYY-MM-DD).' },
    });
  });
});
