import { AmTasksService, amTaskOverdue } from './am-tasks.service';

const STAFF_ID = 42;
const PAUSED_ID = '19d722af-0000-4000-8000-0000000000aa';
const OVERDUE_ID = '19d722af-0000-4000-8000-0000000000bb';
const PAST_DUE = '2020-01-01T00:00:00.000Z';

describe('AmTasksService', () => {
  const audit = {
    calls: [] as Array<{ action: string }>,
    insert: jest.fn(async (row: { action: string }) => {
      audit.calls.push(row);
    }),
  };

  const repo = {
    findById: jest.fn(),
    accept: jest.fn(),
    findOpenBySourceRef: jest.fn(),
    insert: jest.fn(),
    dismiss: jest.fn(),
    query: jest.fn(),
  };

  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({
      caps: [{ section: 'crm_am', action: 'view' }],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  };

  let service: AmTasksService;

  beforeEach(() => {
    audit.calls.length = 0;
    jest.clearAllMocks();
    repo.findById.mockResolvedValue({
      id: 'task-1',
      assignee_staff_id: null,
      status: 'new',
    });
    repo.accept.mockImplementation(async (id: string, staffId: number) => ({
      id,
      assignee_staff_id: staffId,
      status: 'in_progress',
    }));
    repo.findOpenBySourceRef.mockResolvedValue({ id: 'existing', source: 'csd', source_ref: 'T-1' });
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmTasksService(repo as never, audit as never, staffAuth as never);
  });

  it('accept assigns current staff and writes audit', async () => {
    const taskId = '19d722af-0000-4000-8000-000000000002';
    repo.findById.mockResolvedValue({
      id: taskId,
      assignee_staff_id: null,
      status: 'new',
    });
    const out = await service.accept(taskId, 42);
    expect(out.assignee_staff_id).toBe(42);
    expect(out.status).toBe('in_progress');
    expect(audit.calls[0].action).toBe('task.accept');
  });

  it('rejects non-UUID agency_client_id', async () => {
    await expect(
      service.create({ agency_client_id: 'c1', title: 'A' }, 1),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('rejects duplicate open source_ref', async () => {
    await expect(
      service.create(
        {
          agency_client_id: '19d722af-0000-4000-8000-000000000001',
          title: 'A',
          source: 'csd',
          source_ref: 'T-1',
        },
        1,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('list sla=breached excludes paused waiting_client and includes overdue in_progress', async () => {
    expect(
      amTaskOverdue({
        status: 'waiting_client',
        sla_paused: true,
        sla_resolve_due_at: PAST_DUE,
      }),
    ).toBe(false);
    expect(
      amTaskOverdue({
        status: 'in_progress',
        sla_paused: false,
        sla_resolve_due_at: PAST_DUE,
      }),
    ).toBe(true);

    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/t\.title/.test(text) && /sla_resolve_due_at/.test(text)) {
        expect(text).toMatch(/waiting_client/);
        expect(text).toMatch(/sla_paused/);
        expect(text).toMatch(/sla_resolve_due_at/);
        return {
          rows: [
            {
              id: PAUSED_ID,
              agency_client_id: '19d722af-0000-4000-8000-000000000001',
              account_name: 'Paused Co',
              title: 'Wait client',
              kind: 'task',
              priority: 'medium',
              status: 'waiting_client',
              assignee_staff_id: STAFF_ID,
              assignee_label: 'Minh',
              due_at: PAST_DUE,
              sla_first_due_at: PAST_DUE,
              sla_resolve_due_at: PAST_DUE,
              sla_paused: true,
              source: 'manual',
              source_ref: null,
            },
            {
              id: OVERDUE_ID,
              agency_client_id: '19d722af-0000-4000-8000-000000000002',
              account_name: 'Overdue Co',
              title: 'Fix now',
              kind: 'issue',
              priority: 'high',
              status: 'in_progress',
              assignee_staff_id: STAFF_ID,
              assignee_label: 'Minh',
              due_at: PAST_DUE,
              sla_first_due_at: PAST_DUE,
              sla_resolve_due_at: PAST_DUE,
              sla_paused: false,
              source: 'manual',
              source_ref: null,
            },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const out = await service.list(viewReq as never, { sla: 'breached', inbox: 'me' });
    expect(out.items.map((row) => row.id)).toEqual([OVERDUE_ID]);
    expect(out.items[0].overdue).toBe(true);
    expect(out.items[0].sla_clock).not.toBe('paused');
  });
});
