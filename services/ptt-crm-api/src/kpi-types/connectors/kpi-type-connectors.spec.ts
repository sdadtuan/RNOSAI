import { AdsMetaKpiTypeAdapter } from './ads-meta.adapter';
import { applyDivideByZero } from './kpi-type-connector.port';
import type { KpiFormulaAst } from '../formula/kpi-type-formula.parser';

describe('AdsMetaKpiTypeAdapter', () => {
  const ast: KpiFormulaAst = {
    aggregation: 'SUM',
    entity: 'AdSpend',
    field: 'amount',
    filters: [{ field: 'date', op: 'in_period' }],
  };
  const period = {
    from: new Date('2026-07-01T00:00:00Z'),
    to: new Date('2026-10-01T00:00:00Z'),
  };

  it('returns SUM spend when query succeeds', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (String(sql).includes('MAX(synced_at)')) {
          return { rows: [{ max: new Date().toISOString() }] };
        }
        return {};
      }),
      connect: jest.fn(async () => ({
        query: jest.fn(async (sql: string) => {
          if (String(sql).includes('statement_timeout')) return {};
          return { rows: [{ value: '1250000', scanned: '12' }] };
        }),
        release: jest.fn(),
      })),
    };
    const adapter = new AdsMetaKpiTypeAdapter(db as never);
    const out = await adapter.preview(ast, period);
    expect(out.value).toBe(1_250_000);
    expect(out.records_scanned).toBe(12);
    expect(out.health).toBe('HEALTHY');
  });

  it('returns 0 when table is empty but query succeeds', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [{ max: new Date().toISOString() }] })),
      connect: jest.fn(async () => ({
        query: jest.fn(async (sql: string) => {
          if (String(sql).includes('statement_timeout')) return {};
          return { rows: [{ value: '0', scanned: '0' }] };
        }),
        release: jest.fn(),
      })),
    };
    const adapter = new AdsMetaKpiTypeAdapter(db as never);
    const out = await adapter.preview(ast, period);
    expect(out.value).toBe(0);
    expect(out.health).toBe('HEALTHY');
  });

  it('returns CONNECTION_ERROR when query throws — never fakes 0', async () => {
    const db = {
      query: jest.fn(async () => ({ rows: [{ max: new Date().toISOString() }] })),
      connect: jest.fn(async () => ({
        query: jest.fn(async (sql: string) => {
          if (String(sql).includes('statement_timeout')) return {};
          throw new Error('relation daily_performance does not exist');
        }),
        release: jest.fn(),
      })),
    };
    const adapter = new AdsMetaKpiTypeAdapter(db as never);
    const out = await adapter.preview(ast, period);
    expect(out.value).toBeNull();
    expect(out.health).toBe('CONNECTION_ERROR');
  });
});

describe('applyDivideByZero', () => {
  it('ERROR leaves value null', () => {
    expect(applyDivideByZero(100, 0, 'ERROR')).toEqual({ value: null, error: 'DIVIDE_BY_ZERO' });
  });
  it('ZERO returns 0', () => {
    expect(applyDivideByZero(100, 0, 'ZERO')).toEqual({ value: 0 });
  });
});
