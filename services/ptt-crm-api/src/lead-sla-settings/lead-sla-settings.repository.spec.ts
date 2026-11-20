import { LeadSlaSettingsRepository } from './lead-sla-settings.repository';

describe('LeadSlaSettingsRepository bootstrapSchema', () => {
  it('does not reset crm_staff.can_receive_leads to TRUE on restart when the column already exists', async () => {
    const queries: string[] = [];
    const repo = new LeadSlaSettingsRepository({ databaseUrl: 'postgres://unused' } as never);
    (repo as unknown as { pool: { query: jest.Mock } }).pool = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (/information_schema\.columns/i.test(sql)) {
          return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    await repo.onModuleInit();

    expect(queries.some((q) => /UPDATE\s+crm_staff\s+s\s+SET\s+can_receive_leads\s*=\s*TRUE/i.test(q))).toBe(
      false,
    );
  });

  it('runs the one-time backfill only when can_receive_leads column is newly created', async () => {
    const queries: string[] = [];
    const repo = new LeadSlaSettingsRepository({ databaseUrl: 'postgres://unused' } as never);
    (repo as unknown as { pool: { query: jest.Mock } }).pool = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (/information_schema\.columns/i.test(sql)) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    await repo.onModuleInit();

    expect(queries.some((q) => /UPDATE\s+crm_staff\s+s\s+SET\s+can_receive_leads\s*=\s*TRUE/i.test(q))).toBe(
      true,
    );
  });
});
