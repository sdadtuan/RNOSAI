import { AM_TENANT_ID } from './am-audit.repository';
import { AmNotificationsRepository, AmNotificationsService } from './am-notifications.service';

type Row = {
  id: string;
  staff_id: number;
  kind: string;
  title: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function makeRow(partial: Partial<Row> & Pick<Row, 'id' | 'staff_id' | 'kind'>): Row {
  return {
    title: partial.title ?? 'notify',
    href: partial.href ?? '/crm/account-management/work/1',
    read_at: partial.read_at ?? null,
    created_at: partial.created_at ?? '2026-09-05T01:00:00.000Z',
    ...partial,
  };
}

describe('AmNotificationsService', () => {
  const repo = {
    listForStaff: jest.fn(),
    insert: jest.fn(),
    markRead: jest.fn(),
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

  it('mark-read by staff A does not change staff B unread', async () => {
    const rows = [
      makeRow({ id: 'a1', staff_id: 1, kind: 'sla.breached', title: 'SLA A' }),
      makeRow({ id: 'b1', staff_id: 2, kind: 'sla.breached', title: 'SLA B' }),
    ];
    const store = {
      listForStaff: async (staffId: number) => rows.filter((row) => row.staff_id === staffId),
      markRead: async (id: string, staffId: number) => {
        const row = rows.find((item) => item.id === id && item.staff_id === staffId);
        if (!row) return null;
        row.read_at = '2026-09-05T08:00:00.000Z';
        return { ...row };
      },
      insert: jest.fn(),
    };
    const isolated = new AmNotificationsService(store as never);

    const marked = await isolated.markRead('a1', 1);
    expect(marked.id).toBe('a1');
    expect(marked.read_at).toBe('2026-09-05T08:00:00.000Z');

    const staffA = await isolated.list(1);
    const staffB = await isolated.list(2);
    expect(staffA.unread).toBe(0);
    expect(staffB.unread).toBe(1);
    expect(staffB.items[0].read_at).toBeNull();
  });

  it('returns 404 when mark-read id is missing or owned by another staff', async () => {
    repo.markRead.mockResolvedValue(null);
    await expect(service.markRead('missing', 1)).rejects.toMatchObject({ status: 404 });
    expect(repo.markRead).toHaveBeenCalledWith('missing', 1);
  });

  it('notifyInvoicePaid inserts invoice.paid with finance href and no GET side-effect', async () => {
    repo.insert.mockResolvedValue({
      id: 'inv1',
      kind: 'invoice.paid',
      title: 'HĐ 88 đã thanh toán',
      href: '/crm/account-management/clients/19d722af-0000-4000-8000-000000000001?tab=finance',
      read_at: null,
      created_at: '2026-09-05T01:00:00.000Z',
    });

    const out = await service.notifyInvoicePaid({
      staff_id: 7,
      agency_client_id: '19d722af-0000-4000-8000-000000000001',
      title: 'HĐ 88 đã thanh toán',
    });

    expect(out).toBeTruthy();
    expect(out!.kind).toBe('invoice.paid');
    expect(repo.insert).toHaveBeenCalledWith({
      staff_id: 7,
      kind: 'invoice.paid',
      title: 'HĐ 88 đã thanh toán',
      href: '/crm/account-management/clients/19d722af-0000-4000-8000-000000000001?tab=finance',
    });
    expect(repo.listForStaff).not.toHaveBeenCalled();
  });
});

describe('AmNotificationsRepository', () => {
  it('mark-read SQL scopes UPDATE to actor staff_id', async () => {
    const query = jest.fn(async () => ({
      rows: [
        {
          id: 'n1',
          kind: 'sla.breached',
          title: 'SLA',
          href: '/x',
          read_at: '2026-09-05T08:00:00.000Z',
          created_at: '2026-09-05T01:00:00.000Z',
        },
      ],
      rowCount: 1,
    }));
    const store = new AmNotificationsRepository({ databaseUrl: 'postgres://x' } as never);
    (store as unknown as { pool: { query: typeof query } }).pool = { query };

    const out = await store.markRead('n1', 7);

    expect(out?.id).toBe('n1');
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/UPDATE\s+crm_am_notifications/i);
    expect(sql).toMatch(/read_at\s*=\s*now\(\)/i);
    expect(sql).toMatch(/staff_id\s*=/i);
    expect(params).toEqual([AM_TENANT_ID, 'n1', 7]);
  });

  it('skips insert when an unread row already exists for same staff, kind, href', async () => {
    const query = jest.fn(async (sql: string) => {
      if (/read_at\s+is\s+null/i.test(sql)) {
        return {
          rows: [
            {
              id: 'n-existing',
              kind: 'renewal.ending',
              title: 'Gia hạn EduNext',
              href: '/crm/account-management/renewals',
              read_at: null,
              created_at: '2026-09-05T01:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const store = new AmNotificationsRepository({ databaseUrl: 'postgres://x' } as never);
    (store as unknown as { pool: { query: typeof query } }).pool = { query };

    const out = await store.insert({
      staff_id: 11,
      kind: 'renewal.ending',
      title: 'Gia hạn EduNext',
      href: '/crm/account-management/renewals',
    });

    expect(out.id).toBe('n-existing');
    expect(query.mock.calls.some(([sql]) => /insert into crm_am_notifications/i.test(String(sql)))).toBe(
      false,
    );
  });
});
