import { AmNotificationsService } from './am-notifications.service';

describe('AmNotificationsService', () => {
  const repo = {
    listForStaff: jest.fn(),
  };

  let service: AmNotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmNotificationsService(repo as never);
  });

  it('returns empty items and unread 0 when staff is missing', async () => {
    const out = await service.list(0);
    expect(out).toEqual({ items: [], unread: 0 });
    expect(repo.listForStaff).not.toHaveBeenCalled();
  });

  it('returns items and unread from unread rows, never a hard-coded 5', async () => {
    repo.listForStaff.mockResolvedValue([
      {
        id: 'n1',
        kind: 'sla.breached',
        title: 'SLA trễ',
        href: '/crm/account-management/work/1',
        read_at: null,
        created_at: '2026-09-05T01:00:00.000Z',
      },
      {
        id: 'n2',
        kind: 'invoice.paid',
        title: 'HĐ đã thanh toán',
        href: null,
        read_at: '2026-09-04T10:00:00.000Z',
        created_at: '2026-09-04T10:00:00.000Z',
      },
    ]);

    const out = await service.list(7);

    expect(out.items).toHaveLength(2);
    expect(out.unread).toBe(1);
    expect(out.unread).not.toBe(5);
    expect(repo.listForStaff).toHaveBeenCalledWith(7);
  });

  it('returns unread 0 for an empty stub list', async () => {
    repo.listForStaff.mockResolvedValue([]);
    const out = await service.list(7);
    expect(out).toEqual({ items: [], unread: 0 });
  });
});
