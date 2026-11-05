import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const repo = {
    list: jest.fn(),
    getById: jest.fn(),
    customerExists: jest.fn(),
    create: jest.fn(),
    createFromProposal: jest.fn(),
    patch: jest.fn(),
    setStatus: jest.fn(),
    addLine: jest.fn(),
    deleteLine: jest.fn(),
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(repo as never);
  });

  it('creates order for valid customer', async () => {
    repo.customerExists.mockResolvedValue(true);
    repo.create.mockResolvedValue({ id: 1, reference_code: 'SO-2026-00001', status: 'draft' });
    const out = await service.create({ customer_id: 10 });
    expect(out.order.id).toBe(1);
    expect(repo.create).toHaveBeenCalled();
  });

  it('converts proposal to order', async () => {
    repo.createFromProposal.mockResolvedValue({ id: 2, proposal_id: 5, status: 'draft' });
    const out = await service.convertFromProposal(5);
    expect(out.order.proposal_id).toBe(5);
  });
});
