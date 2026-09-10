import { ContentOsPortfolioService } from './content-os-portfolio.service';

describe('ContentOsPortfolioService.createRequest', () => {
  let repo: {
    nextRequestSeq?: jest.Mock;
    insertRequest?: jest.Mock;
    getRequestById?: jest.Mock;
    updateRequestStatus?: jest.Mock;
    nextItemSeq?: jest.Mock;
    updateItemRequestLink?: jest.Mock;
  };
  let items: { createItem: jest.Mock };
  let svc: ContentOsPortfolioService;

  beforeEach(() => {
    repo = {};
    items = { createItem: jest.fn() };
    svc = new ContentOsPortfolioService(repo as never, {} as never, {} as never, items as never);
  });

  it('rejects missing deliverable', async () => {
    await expect(
      svc.createRequest({ lifecycleId: 1, actor: 'a@b.c', body: { objective: 'x' } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates Submitted with completeness and CR code', async () => {
    repo.nextRequestSeq = jest.fn().mockResolvedValue(24);
    repo.insertRequest = jest.fn().mockImplementation(async (row) => row);
    const out = await svc.createRequest({
      lifecycleId: 1,
      actor: 'am@ptt.vn',
      body: {
        source: 'account',
        client_label: 'Client A',
        brand_label: 'Brand A',
        deliverable_ask: '12 social posts',
        objective: 'Awareness + qualified lead',
        due_at: '2026-09-20',
        priority: 'High',
      },
    });
    expect(out.display_code).toMatch(/^CR-\d{8}-024$/);
    expect(out.completeness).toBe(100);
    expect(out.triage_status).toBe('Submitted');
  });

  it('converts Accepted request and creates item with CNT code', async () => {
    const accepted = {
      id: 9,
      lifecycle_id: 1,
      deliverable_ask: '12 social posts',
      triage_status: 'Accepted',
    };
    repo.getRequestById = jest.fn().mockResolvedValue(accepted);
    repo.updateRequestStatus = jest.fn().mockImplementation(async (_id: number, status: string) => ({
      ...accepted,
      triage_status: status,
    }));
    repo.nextItemSeq = jest.fn().mockResolvedValue(21);
    repo.updateItemRequestLink = jest.fn().mockImplementation(async (itemId: number, patch: object) => ({
      id: itemId,
      title: '12 social posts',
      ...patch,
    }));
    items.createItem.mockResolvedValue({
      id: 55,
      title: '12 social posts',
      channel: 'facebook',
      format: 'social_post',
    });

    const out = await svc.convertRequest({ requestId: 9, actor: 'am@ptt.vn', body: {} });

    expect(out.request.triage_status).toBe('Converted');
    expect(items.createItem).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: '12 social posts',
        channel: 'facebook',
        format: 'social_post',
      }),
      'am@ptt.vn',
    );
    expect(out.item.request_id).toBe(9);
    expect(out.item.display_code).toMatch(/^CNT-\d{8}-021$/);
  });
});
