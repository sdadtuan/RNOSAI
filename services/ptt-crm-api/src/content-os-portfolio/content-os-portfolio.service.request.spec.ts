import { ContentOsPortfolioService } from './content-os-portfolio.service';

describe('ContentOsPortfolioService.createRequest', () => {
  let repo: {
    listScopedLifecycleIds?: jest.Mock;
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
    repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([1]) };
    items = { createItem: jest.fn() };
    svc = new ContentOsPortfolioService(repo as never, {} as never, {} as never, items as never);
  });

  it('rejects missing deliverable', async () => {
    await expect(
      svc.createRequest({ staffId: 1, lifecycleId: 1, actor: 'a@b.c', body: { objective: 'x' } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([0, NaN])('rejects invalid lifecycleId %p with 400 and no insert', async (lifecycleId) => {
    repo.nextRequestSeq = jest.fn();
    repo.insertRequest = jest.fn();
    await expect(
      svc.createRequest({ staffId: 1, lifecycleId, actor: 'a@b.c', body: { deliverable_ask: 'posts' } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.nextRequestSeq).not.toHaveBeenCalled();
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('rejects lifecycle outside staff scope with 403 and no insert', async () => {
    repo.listScopedLifecycleIds = jest.fn().mockResolvedValue([4, 7]);
    repo.nextRequestSeq = jest.fn();
    repo.insertRequest = jest.fn();
    await expect(
      svc.createRequest({
        staffId: 1,
        lifecycleId: 99,
        actor: 'a@b.c',
        body: { deliverable_ask: 'posts' },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.insertRequest).not.toHaveBeenCalled();
    expect(repo.nextRequestSeq).not.toHaveBeenCalled();
  });

  it('creates Submitted with completeness and CR code', async () => {
    repo.nextRequestSeq = jest.fn().mockResolvedValue(24);
    repo.insertRequest = jest.fn().mockImplementation(async (row) => row);
    const out = await svc.createRequest({
      staffId: 1,
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
      master_id: null,
      display_code: 'CNT-20260910-021',
    });

    const out = await svc.convertRequest({ staffId: 1, requestId: 9, actor: 'am@ptt.vn', body: {} });

    expect(out.request.triage_status).toBe('Converted');
    expect(items.createItem).toHaveBeenCalledTimes(1);
    expect(items.createItem).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: '12 social posts',
        channel: 'facebook',
        format: 'social_post',
        as_master: true,
      }),
      'am@ptt.vn',
    );
    expect(repo.nextItemSeq).not.toHaveBeenCalled();
    expect(repo.updateItemRequestLink).toHaveBeenCalledWith(55, { request_id: 9 });
    expect(out.item.request_id).toBe(9);
    expect(out.item.master_id).toBeNull();
    expect(out.item.display_code).toMatch(/^CNT-\d{8}-021$/);
  });

  it('leaves request Accepted when createItem throws', async () => {
    const accepted = {
      id: 9,
      lifecycle_id: 1,
      deliverable_ask: '12 social posts',
      triage_status: 'Accepted',
    };
    repo.getRequestById = jest.fn().mockResolvedValue(accepted);
    repo.updateRequestStatus = jest.fn();
    items.createItem.mockRejectedValue(new Error('create failed'));

    await expect(svc.convertRequest({ staffId: 1, requestId: 9, actor: 'am@ptt.vn', body: {} })).rejects.toThrow(
      'create failed',
    );

    expect(repo.updateRequestStatus).not.toHaveBeenCalled();
  });

  it('rejects convert when request lifecycle is outside staff scope with 403 and no item insert', async () => {
    repo.listScopedLifecycleIds = jest.fn().mockResolvedValue([4, 7]);
    repo.getRequestById = jest.fn().mockResolvedValue({
      id: 9,
      lifecycle_id: 99,
      deliverable_ask: '12 social posts',
      triage_status: 'Accepted',
    });
    repo.updateRequestStatus = jest.fn();
    await expect(svc.convertRequest({ staffId: 1, requestId: 9, actor: 'am@ptt.vn', body: {} })).rejects.toMatchObject({
      status: 403,
    });
    expect(items.createItem).not.toHaveBeenCalled();
    expect(repo.updateRequestStatus).not.toHaveBeenCalled();
  });
});
