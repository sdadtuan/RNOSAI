import { PerformanceRepository } from './performance.repository';

describe('PerformanceRepository', () => {
  it('round-trips assignment in memory when postgres url invalid', async () => {
    const repo = new PerformanceRepository({ databaseUrl: 'postgres://invalid' } as never);
    const row = await repo.insertAssignment({
      name: 'CPL Valid Lead',
      definition_code: 'MKT_006',
      owner_name: 'Lê Hoàng',
      scope_type: 'campaign',
      scope_id: 'an-phat',
      scope_name: 'An Phát',
      direction: 'lower',
      target: 100000,
      assigned_target: 100000,
      quoted_target: 100000,
      period_label: '09/2026',
    });
    expect((await repo.getAssignment(row.id))?.definition_code).toBe('MKT_006');
    expect((await repo.listAssignments()).some((a) => a.id === row.id)).toBe(true);
  });

  it('stores snapshot by scorecard + period', async () => {
    const repo = new PerformanceRepository({ databaseUrl: 'postgres://invalid' } as never);
    await repo.insertSnapshot({
      scorecard_id: 'sc-mkt-lead-q4',
      period_label: 'Q4-2026',
      hash: 'abc',
      payload_json: { ok: true },
    });
    expect((await repo.getSnapshot('sc-mkt-lead-q4', 'Q4-2026'))?.hash).toBe('abc');
  });
});
