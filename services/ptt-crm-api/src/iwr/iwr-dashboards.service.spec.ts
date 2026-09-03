import { ForbiddenException } from '@nestjs/common';
import { IwrDashboardsService } from './iwr-dashboards.service';
import type { IwrActor } from './iwr.types';

describe('IwrDashboardsService', () => {
  const repo = {
    getSnapshot: jest.fn().mockResolvedValue(null),
    upsertSnapshot: jest.fn(),
    staffMetrics: jest.fn().mockResolvedValue({ due_today: true, late_num: 1, late_den: 10, open_blockers: 2 }),
    countUnread: jest.fn().mockResolvedValue(3),
    leaderMetrics: jest.fn(),
    pmMetrics: jest.fn(),
    bodMetrics: jest.fn().mockResolvedValue({
      submit_rate: 0.8,
      rag_red_list: [],
      critical_risks: 1,
      pending_acks: 2,
    }),
  };

  it('staff dash has no revenue fields', async () => {
    const svc = new IwrDashboardsService(repo as never);
    const out = (await svc.get(
      { staffId: 3, staffLabel: 'NV', departmentId: 10, caps: [{ section: 'iwr', action: 'view' }] },
      'staff',
    )) as Record<string, unknown>;
    expect(out).toHaveProperty('due_today');
    expect(out).not.toHaveProperty('revenue');
    expect(out).not.toHaveProperty('submit_rate');
  });

  it('bod without executive cap returns 403', async () => {
    const svc = new IwrDashboardsService(repo as never);
    await expect(
      svc.get({ staffId: 3, staffLabel: 'NV', departmentId: 10, caps: [{ section: 'iwr', action: 'view' }] }, 'bod'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
