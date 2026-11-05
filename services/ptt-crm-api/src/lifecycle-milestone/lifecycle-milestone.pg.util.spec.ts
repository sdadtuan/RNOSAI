import { recordLifecycleMilestone, ensureLifecycleMilestoneSchema } from './lifecycle-milestone.pg.util';

describe('lifecycle-milestone.pg.util', () => {
  it('ensureSchema runs DDL once', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const db = { query } as never;
    await ensureLifecycleMilestoneSchema(db);
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain('crm_lifecycle_milestones');
  });

  it('record inserts with ON CONFLICT DO NOTHING', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const db = { query } as never;
    await recordLifecycleMilestone(db, {
      leadId: 42,
      key: 'b2_done',
      occurredAt: '2026-08-01T10:00:00.000Z',
      source: 'care_pipeline',
    });
    expect(query).toHaveBeenCalledTimes(2);
    const insertSql = String(query.mock.calls[1][0]);
    expect(insertSql).toContain('ON CONFLICT (lead_id, milestone_key) DO NOTHING');
    expect(query.mock.calls[1][1]).toEqual([
      42,
      'b2_done',
      '2026-08-01T10:00:00.000Z',
      'care_pipeline',
      '',
      '{}',
    ]);
  });

  it('record skips invalid lead id', async () => {
    const query = jest.fn();
    const db = { query } as never;
    await recordLifecycleMilestone(db, {
      leadId: 0,
      key: 'b2_done',
      occurredAt: new Date(),
      source: 'care_pipeline',
    });
    expect(query).not.toHaveBeenCalled();
  });
});
