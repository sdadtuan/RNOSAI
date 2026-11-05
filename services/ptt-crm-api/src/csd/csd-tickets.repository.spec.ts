import { CsdTicketsRepository } from './csd-tickets.repository';

describe('CsdTicketsRepository.insert SQL', () => {
  it('casts assignee_staff_id so null does not raise PG 42P18', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params: params ?? [] });
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('INSERT INTO csd_tickets')) {
          return {
            rows: [
              {
                id: 't1',
                tenant_id: 'ptt',
                code: 'PTT-2026-000001',
                factory: 'A',
                title: 'x',
                description: '',
                ticket_type: 'request',
                category: '',
                sub_category: '',
                status: 'new',
                priority: 'P3',
                severity: 'medium',
                scope_status: 'in_scope',
                source_type: 'manual',
                source_id: null,
                client_account_id: null,
                customer_id: null,
                assignee_staff_id: null,
                owner_staff_id: null,
                sla_policy_id: 'pol',
                sla_response_due_at: new Date(),
                sla_resolution_due_at: new Date(),
                sla_status: 'on_track',
                sla_paused: false,
                sla_paused_seconds: 0,
                resolution_note: '',
                created_at: new Date(),
                created_by_staff_id: 5,
                updated_at: new Date(),
                updated_by_staff_id: 5,
                assigned_at: null,
                resolved_at: null,
                closed_at: null,
                first_response_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };

    const repo = Object.create(CsdTicketsRepository.prototype) as CsdTicketsRepository;
    Object.defineProperty(repo, 'db', {
      get: () => ({
        connect: async () => client,
        query: client.query,
      }),
    });

    await repo.insert({
      code: 'PTT-2026-000001',
      title: 'x',
      description: '',
      ticket_type: 'request',
      priority: 'P3',
      status: 'new',
      source_type: 'manual',
      source_id: null,
      client_account_id: null,
      customer_id: null,
      assignee_staff_id: null,
      sla_policy_id: 'pol',
      sla_response_due_at: new Date('2026-09-17T10:00:00Z'),
      sla_resolution_due_at: new Date('2026-09-18T10:00:00Z'),
      created_by_staff_id: 5,
    });

    const insert = queries.find((q) => q.sql.includes('INSERT INTO csd_tickets'));
    expect(insert).toBeTruthy();
    expect(insert!.sql).toMatch(/\$12::integer/);
    expect(insert!.sql).toMatch(/CASE WHEN \$12::integer IS NOT NULL/);
    expect(insert!.params[11]).toBeNull();
  });
});
