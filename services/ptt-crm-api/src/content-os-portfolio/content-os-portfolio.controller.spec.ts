import { ContentOsPortfolioController } from './content-os-portfolio.controller';

describe('ContentOsPortfolioController', () => {
  it('GET command-center delegates to service', async () => {
    const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    await c.commandCenter({ staffUser: { sub: '1' } } as never);
    expect(service.getCommandCenter).toHaveBeenCalled();
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

  it('GET requests delegates to listRequests with staffId', async () => {
    const service = { listRequests: jest.fn().mockResolvedValue({ items: [] }) };
    const c = new ContentOsPortfolioController(service as never);
    const out = await c.listRequests({ staffUser: { sub: '7' } } as never);
    expect(service.listRequests).toHaveBeenCalledWith({ staffId: 7 });
    expect(out).toEqual({ items: [] });
  });
});
