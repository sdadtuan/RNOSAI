import { OpsCrmContextRepository } from './ops-crm-context.repository';

describe('OpsCrmContextRepository writes', () => {
  it('insertPlanDraft inserts status=draft and returns id', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            name: 'AI Draft',
            status: 'draft',
            period_label: 'Q4',
            lifecycle_id: 5,
            success_metrics_json: [],
          },
        ],
      });
    const repo = new OpsCrmContextRepository({ databaseUrl: 'x' } as never);
    (repo as unknown as { pool: { query: typeof query } }).pool = { query };

    const row = await repo.insertPlanDraft({
      name: 'AI Draft',
      period_label: 'Q4',
      objectives: 'obj',
      notes: 'n',
      lifecycle_id: 5,
      strategy_framework_json: { ai_draft: { source_tool: 'marketing_plan.write_draft' } },
    });

    expect(row.id).toBe(99);
    expect(row.status).toBe('draft');
    expect(String(query.mock.calls[0][0])).toContain('INSERT INTO crm_marketing_plans');
    expect(String(query.mock.calls[0][0])).toContain("'draft'");
    expect(query.mock.calls[0][1][1]).toBe('AI Draft');
    expect(query.mock.calls[0][1][2]).toBe(5);
  });

  it('insertAiDraftTask sets is_custom and form_data.ai_draft', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const repo = new OpsCrmContextRepository({ databaseUrl: 'x' } as never);
    (repo as unknown as { pool: { query: typeof query } }).pool = { query };

    const task = await repo.insertAiDraftTask({
      lifecycle_id: 5,
      stage: 'deliver',
      title: '[AI draft] Kickoff',
      description: 'AC',
      form_data: {
        ai_draft: true,
        ai_approved_by: 'ai-tool',
        ai_approved_at: '2026-09-19T00:00:00.000Z',
      },
    });

    expect(task.id).toBe(7);
    expect(String(query.mock.calls[0][0])).toContain('INSERT INTO crm_svc_tasks');
    expect(query.mock.calls[0][1]).toEqual(
      expect.arrayContaining([5, 'deliver', '[AI draft] Kickoff']),
    );
    expect(String(query.mock.calls[0][0])).toContain('is_custom');
  });

  it('clonePlanToDraft forces status draft via insertPlanDraft', async () => {
    const query = jest
      .fn()
      // getPlanForWrite
      .mockResolvedValueOnce({
        rows: [
          {
            id: 8,
            name: 'Live',
            status: 'active',
            period_label: 'Q3',
            lifecycle_id: 5,
            success_metrics_json: [],
            objectives: 'o',
            notes: 'n',
            strategy_framework_json: {},
          },
        ],
      })
      // insert RETURNING
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      // getPlan
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            name: 'Live (draft)',
            status: 'draft',
            period_label: 'Q3',
            lifecycle_id: 5,
            success_metrics_json: [],
          },
        ],
      });
    const repo = new OpsCrmContextRepository({ databaseUrl: 'x' } as never);
    (repo as unknown as { pool: { query: typeof query } }).pool = { query };

    const cloned = await repo.clonePlanToDraft(8, {
      strategy_framework_json: { ai_draft: { source_tool: 'marketing_plan.write_draft' } },
    });
    expect(cloned.id).toBe(20);
    expect(cloned.status).toBe('draft');
    expect(String(query.mock.calls[1][0])).toContain('INSERT INTO crm_marketing_plans');
  });
});
