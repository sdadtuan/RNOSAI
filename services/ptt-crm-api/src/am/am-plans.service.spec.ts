import { AmPlansService } from './am-plans.service';

describe('AmPlansService', () => {
  const repo = {
    insert: jest.fn(),
    deleteById: jest.fn(),
  };
  const tasks = {
    create: jest.fn(),
  };

  let plans: AmPlansService;

  beforeEach(() => {
    jest.clearAllMocks();
    plans = new AmPlansService(repo as never, tasks as never);
  });

  it('renewal plan without contract_id is 400', async () => {
    await expect(plans.create({ agency_client_id: 'c', kind: 'renewal', period_key: '2026-Q3' }, 1))
      .rejects.toMatchObject({ error: 'contract_required' });
  });

  it.each([0, '', '0'])('renewal plan with contract_id %j is 400 contract_required', async (contractId) => {
    await expect(
      plans.create(
        {
          agency_client_id: 'c',
          kind: 'renewal',
          period_key: '2026-Q3',
          contract_id: contractId as never,
        },
        1,
      ),
    ).rejects.toMatchObject({ error: 'contract_required' });
  });

  it('deletes the plan when seed tasks fail so retry is not 409-stuck', async () => {
    const plan = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      agency_client_id: '19d722af-0000-4000-8000-000000000001',
      contract_id: null,
      kind: 'care' as const,
      period_key: '2026-Q3',
      status: 'open',
      owner_staff_id: 1,
      due_on: null,
    };
    repo.insert.mockResolvedValue(plan);
    tasks.create.mockRejectedValue(new Error('seed fail'));

    await expect(
      plans.create(
        {
          agency_client_id: '19d722af-0000-4000-8000-000000000001',
          kind: 'care',
          period_key: '2026-Q3',
        },
        1,
      ),
    ).rejects.toThrow('seed fail');

    expect(repo.deleteById).toHaveBeenCalledWith(plan.id);
  });
});
