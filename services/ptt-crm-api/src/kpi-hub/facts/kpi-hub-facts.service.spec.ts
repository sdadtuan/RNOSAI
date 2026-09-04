import { ratioPeriod } from '../kpi-hub-status';
import { KpiHubFactsRepository } from './kpi-hub-facts.repository';
import { KpiHubFactsService } from './kpi-hub-facts.service';

describe('KpiHubFactsService', () => {
  const dictRows: Record<string, { id: string; code: string }> = {
    MKT_002: { id: 'a0000002-0000-4000-8000-000000000002', code: 'MKT_002' },
    MKT_004: { id: 'a0000004-0000-4000-8000-000000000004', code: 'MKT_004' },
    MKT_006: { id: 'a0000006-0000-4000-8000-000000000006', code: 'MKT_006' },
    MKT_007: { id: 'a0000007-0000-4000-8000-000000000007', code: 'MKT_007' },
    MKT_008: { id: 'a0000008-0000-4000-8000-000000000008', code: 'MKT_008' },
    MKT_009: { id: 'a0000009-0000-4000-8000-000000000009', code: 'MKT_009' },
    SAL_005: { id: 'a0000014-0000-4000-8000-000000000014', code: 'SAL_005' },
    SAL_007: { id: 'a0000015-0000-4000-8000-000000000015', code: 'SAL_007' },
    SAL_008: { id: 'a0000016-0000-4000-8000-000000000016', code: 'SAL_008' },
    MKT_001: { id: 'a0000001-0000-4000-8000-000000000001', code: 'MKT_001' },
    SAL_001: { id: 'a0000010-0000-4000-8000-000000000010', code: 'SAL_001' },
    SAL_003: { id: 'a0000012-0000-4000-8000-000000000012', code: 'SAL_003' },
    SAL_WON: { id: 'a0000017-0000-4000-8000-000000000017', code: 'SAL_WON' },
  };

  const upsertCalls: Array<Record<string, unknown>> = [];

  const factsRepo = {
    upsert: jest.fn(async (input: Record<string, unknown>) => {
      upsertCalls.push(input);
    }),
    getByCodes: jest.fn(async () => new Map()),
    countForDictionary: jest.fn(async () => upsertCalls.length),
  } as unknown as KpiHubFactsRepository;

  const dictRepo = {
    seedIfEmpty: jest.fn(async () => undefined),
    getByCode: jest.fn(async (code: string) => dictRows[code] ?? null),
  };

  const connectors = {
    query: jest.fn<Promise<{ value: number; records_scanned: number; health: 'HEALTHY' }>, [string, string, string | undefined, unknown[], unknown]>(),
  };

  const alertEngine = {
    afterFactCompute: jest.fn(),
  };

  const targets = {
    resolveTarget: jest.fn(() => null),
  };

  const service = new KpiHubFactsService(
    factsRepo,
    dictRepo as never,
    connectors as never,
    alertEngine as never,
    targets as never,
  );

  beforeEach(() => {
    upsertCalls.length = 0;
    jest.clearAllMocks();
    connectors.query.mockResolvedValue({ value: 0, records_scanned: 0, health: 'HEALTHY' });
  });

  it('idempotent upsert — computePeriod writes facts for dashboard KPIs', async () => {
    const first = await service.computePeriod('2026-09');
    const second = await service.computePeriod('2026-09');
    expect(first.facts_written).toBeGreaterThan(0);
    expect(second.status).toBe('SUCCESS');
    expect(factsRepo.upsert).toHaveBeenCalled();
    const mkt002Upserts = upsertCalls.filter((c) => c.dictionary_id === dictRows.MKT_002.id);
    expect(mkt002Upserts.length).toBeGreaterThanOrEqual(2);
  });

  it('ratio non-additive — MKT_006 uses sum(num)/sum(den) not avg of daily ratios', async () => {
    await service.computePeriod('2026-09');

    const mkt006 = upsertCalls.find((c) => c.dictionary_id === dictRows.MKT_006.id);
    expect(mkt006).toBeDefined();
    expect(mkt006?.num_value).toBe(210980000);
    expect(mkt006?.den_value).toBe(1486);
    expect(mkt006?.actual_value).toBe(142000);

    const dailyRatios = [210980000 / 800, 0 / 686];
    const wrongAvg = dailyRatios.reduce((a, b) => a + b, 0) / dailyRatios.length;
    expect(mkt006?.actual_value).not.toBeCloseTo(wrongAvg, 0);
    expect(ratioPeriod(210980000, 1486, true)).toBeCloseTo(142000, -2);
  });

  it('MKT_008 ratio stored as percentage', async () => {
    await service.computePeriod('2026-09');
    const mkt008 = upsertCalls.find((c) => c.dictionary_id === dictRows.MKT_008.id);
    expect(mkt008?.actual_value).toBe(24.8);
    expect(ratioPeriod(369, 1486, true)).toBeCloseTo(0.248, 3);
  });

  it('MKT_009 ratio uses SAL_008 / MKT_004 not avg daily', async () => {
    await service.computePeriod('2026-09');
    const mkt009 = upsertCalls.find((c) => c.dictionary_id === dictRows.MKT_009.id);
    expect(mkt009).toBeDefined();
    expect(mkt009?.num_value).toBe(1240000000);
    expect(mkt009?.den_value).toBe(210980000);
    expect(mkt009?.actual_value).toBeCloseTo(1240000000 / 210980000, 2);
  });
});

describe('KpiHubFactsRepository upsert idempotency', () => {
  it('updates existing row on second upsert with same key', async () => {
    const queries: string[] = [];
    const rows: Array<{ id: string }> = [{ id: 'fact-1' }];

    const db = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('SELECT id FROM crm_kpi_facts')) {
          return { rows: queries.filter((q) => q.includes('INSERT')).length > 0 ? rows : [] };
        }
        return { rows: [] };
      }),
    };

    const repo = new KpiHubFactsRepository({ databaseUrl: 'postgres://test' } as never);
    Object.defineProperty(repo, 'db', { get: () => db });

    const input = {
      dictionary_id: 'a0000002-0000-4000-8000-000000000002',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      actual_value: 100,
    };

    await repo.upsert(input);
    await repo.upsert({ ...input, actual_value: 200 });

    expect(db.query).toHaveBeenCalledTimes(4);
    expect(queries.some((q) => q.includes('UPDATE crm_kpi_facts'))).toBe(true);
  });
});
