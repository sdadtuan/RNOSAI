import { ContentOsPortfolioController } from './content-os-portfolio.controller';

describe('ContentOsPortfolioController', () => {
  it('GET command-center delegates to service', async () => {
    const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    await c.commandCenter({ staffUser: { sub: '1' } } as never);
    expect(service.getCommandCenter).toHaveBeenCalled();
  });

  it('GET command-center passes ?lifecycle= as a hint', async () => {
    const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    await c.commandCenter({ staffUser: { sub: '7' } } as never, '4');
    expect(service.getCommandCenter).toHaveBeenCalledWith({ staffId: 7, lifecycleHint: 4 });
  });

  it('GET approvals delegates to listApprovals with staffId', async () => {
    const service = { listApprovals: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.approvals({ staffUser: { sub: '7' } } as never);
    expect(service.listApprovals).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ items: [] });
  });

  it('GET publications delegates to listPublications with staffId and range', async () => {
    const service = { listPublications: jest.fn().mockResolvedValue({ slots: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.publications({ staffUser: { sub: '7' } } as never, '2026-09-07', '2026-09-13');
    expect(service.listPublications).toHaveBeenCalledWith({
      staffId: 7,
      from: '2026-09-07',
      to: '2026-09-13',
    });
    expect(out).toEqual({ slots: [] });
  });

  it('GET channel-health delegates to getChannelHealth with staffId', async () => {
    const service = {
      getChannelHealth: jest.fn().mockResolvedValue({ channels: [{ channel: 'facebook', status: 'Manual' }] }),
    };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.channelHealth({ staffUser: { sub: '7' } } as never);
    expect(service.getChannelHealth).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ channels: [{ channel: 'facebook', status: 'Manual' }] });
  });

  it('GET requests delegates to listRequests with staffId', async () => {
    const service = { listRequests: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listRequests({ staffUser: { sub: '7' } } as never);
    expect(service.listRequests).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ items: [] });
  });

  it('GET items/:itemId delegates to getPortfolioItem with staffId and lifecycle hint', async () => {
    const item = { id: 21, lifecycle_id: 4 };
    const service = { getPortfolioItem: jest.fn().mockResolvedValue(item) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.getPortfolioItem(21, { staffUser: { sub: '7' } } as never, '4');
    expect(service.getPortfolioItem).toHaveBeenCalledWith({ staffId: 7, itemId: 21, lifecycleHint: 4 });
    expect(out).toEqual(item);
  });

  it('GET insights delegates to listInsights with staffId and lifecycle hint', async () => {
    const service = { listInsights: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listInsights({ staffUser: { sub: '7' } } as never, '4');
    expect(service.listInsights).toHaveBeenCalledWith({ staffId: 7, lifecycleHint: 4 });
    expect(out).toEqual({ items: [] });
  });

  it('POST insights/:id/approve delegates to approveInsight', async () => {
    const approved = { id: 11, status: 'Approved' };
    const service = { approveInsight: jest.fn().mockResolvedValue(approved) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.approveInsight(11, { staffUser: { sub: '7' } } as never);
    expect(service.approveInsight).toHaveBeenCalledWith({ staffId: 7, insightId: 11 });
    expect(out).toEqual(approved);
  });

  it('GET items/:itemId/ai-traces delegates to listAiTraces with staffId and lifecycle hint', async () => {
    const traces = { items: [{ at: '2026-09-10T08:00:00.000Z', intent: 'Draft generate', sources: [], job_id: 55, status: 'succeeded' }] };
    const service = { listAiTraces: jest.fn().mockResolvedValue(traces) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listAiTraces(21, { staffUser: { sub: '7' } } as never, '4');
    expect(service.listAiTraces).toHaveBeenCalledWith({ staffId: 7, itemId: 21, lifecycleHint: 4 });
    expect(out).toEqual(traces);
  });
});
