import { AmPlansService } from './am-plans.service';

describe('AmPlansService', () => {
  const repo = {
    insert: jest.fn(),
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
});
