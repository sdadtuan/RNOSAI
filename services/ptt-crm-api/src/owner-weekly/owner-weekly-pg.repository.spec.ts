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

  it('dashboard includes lifecycle block with K1–K4 metrics', async () => {
    query.mockImplementation(async (sql: string) => {
      const normalized = String(sql);
      if (normalized.includes('crm_owner_cash_snapshots') && normalized.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      if (normalized.includes('thresholds_json')) return { rows: [] };
      if (normalized.includes("milestone_key = 'b2_done'") && normalized.includes('created_at')) {
        return {
          rows: [
            { created_at: '2026-08-01T08:00:00Z', b2_at: '2026-08-01T09:00:00Z' },
            { created_at: '2026-08-02T08:00:00Z', b2_at: '2026-08-02T09:30:00Z' },
            { created_at: '2026-08-03T08:00:00Z', b2_at: '2026-08-03T10:00:00Z' },
          ],
        };
      }
      if (normalized.includes("milestone_key = 'b2_done'") && normalized.includes('intake_go')) {
        return {
          rows: [
            { b2_at: '2026-08-01T08:00:00Z', intake_at: '2026-08-03T08:00:00Z' },
            { b2_at: '2026-08-02T08:00:00Z', intake_at: '2026-08-04T08:00:00Z' },
            { b2_at: '2026-08-03T08:00:00Z', intake_at: '2026-08-05T08:00:00Z' },
          ],
        };
      }
      if (normalized.includes("milestone_key = 'contract_active'")) {
        return {
          rows: [
            { contract_at: '2026-08-01T08:00:00Z', client_at: '2026-08-08T08:00:00Z' },
            { contract_at: '2026-08-02T08:00:00Z', client_at: '2026-08-10T08:00:00Z' },
            { contract_at: '2026-08-03T08:00:00Z', client_at: '2026-08-12T08:00:00Z' },
          ],
        };
      }
      if (normalized.includes('FROM crm_leads') && normalized.includes('spa_meta')) {
        return { rows: [] };
      }
      if (normalized.includes('crm_svc_payments') || normalized.includes('crm_svc_expenses') || normalized.includes('crm_invoices')) {
        return { rows: [{ value: '0' }] };
      }
      if (normalized.includes('LIMIT $1') && normalized.includes('crm_owner_cash_snapshots')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const dashboard = await repo.dashboard({ weekEnd: '2026-08-24' });
    const lifecycle = (dashboard.blocks as Record<string, Record<string, unknown>>).lifecycle;
    const keys = ((lifecycle.metrics as Record<string, unknown>[]) ?? []).map((m) => m.key);
    expect(keys).toEqual([
      'k1_b2_minutes',
      'k2_intake_days',
      'k3_client_active_days',
      'k4_first_call_pct',
    ]);
  });

  it('loadLifecycleKpiStrip wraps loadLifecycleKpis and maps yellow→amber', async () => {
    query.mockImplementation(async (sql: string) => {
      const normalized = String(sql);
      if (normalized.includes('CREATE TABLE')) return { rows: [] };
      if (normalized.includes('thresholds_json')) return { rows: [] };
      if (normalized.includes("milestone_key = 'b2_done'") && normalized.includes('created_at')) {
        return {
          rows: [
            { created_at: '2026-08-01T08:00:00Z', b2_at: '2026-08-01T09:00:00Z' },
            { created_at: '2026-08-02T08:00:00Z', b2_at: '2026-08-02T09:30:00Z' },
            { created_at: '2026-08-03T08:00:00Z', b2_at: '2026-08-03T10:00:00Z' },
          ],
        };
      }
      if (normalized.includes('FROM crm_leads') && normalized.includes('spa_meta')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const strip = await repo.loadLifecycleKpiStrip();
    expect(strip.map((item) => item.key)).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(strip.every((item) => ['green', 'amber', 'red', 'neutral'].includes(item.status))).toBe(true);
    expect(strip.find((item) => item.key === 'k1')?.value).not.toBe(0);
  });
});
