import { DeliveryProjectsRepository } from './delivery-projects.repository';

describe('DeliveryProjectsRepository.backfillFromB2b', () => {
  it('inserts a header per missing b2b row and skips existing', async () => {
    const calls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.includes('FROM crm_b2b_projects b')) {
          return {
            rows: [
              {
                id: 'bbbb0001-0000-4000-8000-000000000001',
                code: 'PTT-LEGACY',
                name: 'PTT Legacy (backfill)',
                status: 'paused',
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const repo = new DeliveryProjectsRepository(db as never);
    const out = await repo.backfillFromB2b(1);
    expect(out.inserted).toBe(1);
    expect(calls.some((s) => s.includes('INSERT INTO crm_delivery_projects'))).toBe(true);
  });
});
