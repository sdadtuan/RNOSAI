import type { HubApprovalsResponse } from '../kpi-hub/approvals/kpi-hub-approvals.service';
import { RevopsApprovalsService } from './revops-approvals.service';

describe('RevopsApprovalsService', () => {
  const hubFixture: HubApprovalsResponse = {
    total: 3,
    groups: [
      {
        id: 'kpi',
        label: 'KPI Dictionary',
        count: 1,
        items: [
          {
            id: 'kpi-1',
            kind: 'kpi',
            label: 'REV-01 — Doanh thu',
            status: 'PENDING_APPROVAL',
            href: '/crm/kpi-hub/dictionary?id=kpi-1',
          },
        ],
      },
      {
        id: 'delivery',
        label: 'Delivery',
        count: 1,
        items: [
          {
            id: 'dp-9',
            kind: 'delivery_project',
            label: 'PRJ-9 — Website',
            status: 'pending_approval',
            href: '/crm/delivery-projects/dp-9',
            policy: [{ role: 'lead', label: 'Team Lead' }],
          },
        ],
      },
      {
        id: 'change_request',
        label: 'Change Request',
        count: 1,
        items: [
          {
            id: 'cr-2',
            kind: 'change_request',
            label: 'PRJ-1 — CR scope',
            status: 'pending',
            href: '/crm/delivery-projects/p1',
          },
        ],
      },
    ],
  };

  it('maps kpi-hub queue to unified revops approvals with KPI counts', async () => {
    const kpiHub = { list: jest.fn().mockResolvedValue(hubFixture) };
    const svc = new RevopsApprovalsService(kpiHub as never);
    const out = await svc.list();

    expect(out.kpis.pendingAll).toBe(3);
    expect(out.kpis.waitingForMe).toBe(2);
    expect(out.kpis.approvedToday).toBe(0);
    expect(out.queue[0]?.kind).toBe('commission');
    expect(out.queue[0]?.canAct).toBe(false);
    expect(out.queue.find((i) => i.id === 'dp-9')?.canAct).toBe(true);
    expect(out.discountMatrix).toHaveLength(4);
  });

  it('returns empty facade when kpi-hub fails', async () => {
    const kpiHub = { list: jest.fn().mockRejectedValue(new Error('down')) };
    const svc = new RevopsApprovalsService(kpiHub as never);
    const out = await svc.list();
    expect(out.queue).toEqual([]);
    expect(out.kpis.pendingAll).toBe(0);
  });
});
