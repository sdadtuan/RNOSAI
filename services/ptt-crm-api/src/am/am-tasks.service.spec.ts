import { AmTasksService, amTaskOverdue } from './am-tasks.service';

const STAFF_ID = 42;
const PAUSED_ID = '19d722af-0000-4000-8000-0000000000aa';
const OVERDUE_ID = '19d722af-0000-4000-8000-0000000000bb';
const TASK_ID = '19d722af-0000-4000-8000-0000000000cc';
const PAST_DUE = '2020-01-01T00:00:00.000Z';

function issueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    agency_client_id: '19d722af-0000-4000-8000-000000000001',
    account_name: 'EduNext',
    title: 'Fix CPL',
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
    waiting_client_reason: null,
    resolution_summary: null,
    resolution_category: null,
    escalation_level: null,
    csd_ticket_id: '19d722af-0000-4000-8000-0000000000dd',
    created_at: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

  const notifications = {
    insert: jest.fn(),
    listForStaff: jest.fn(),
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
    notifications.insert.mockResolvedValue({ id: 'n1', kind: 'escalation' });
    service = new AmTasksService(
      repo as never,
      audit as never,
      staffAuth as never,
      notifications as never,
    );
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

  it('waiting_client without reason returns 400 reason_required and does not UPDATE', async () => {
    await expect(service.waitingClient(viewReq as never, TASK_ID, { reason: '  ' }, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'reason_required',
    });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE/i.test(String(sql)))).toBe(false);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('escalate notifies only and never calls optional CSD resolve', async () => {
    const csd = { resolve: jest.fn() };
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/UPDATE/i.test(text)) {
        return { rows: [issueRow({ escalation_level: 'director' })], rowCount: 1 };
      }
      return { rows: [issueRow()], rowCount: 1 };
    });
    service = new AmTasksService(
      repo as never,
      audit as never,
      staffAuth as never,
      notifications as never,
      undefined,
      csd,
    );

    const out = await service.escalate(
      viewReq as never,
      TASK_ID,
      { level: 'director', recipient_staff_id: 9, summary: 'Need help', reason: 'SLA' },
      STAFF_ID,
    );

    expect(csd.resolve).not.toHaveBeenCalled();
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_id: 9,
        kind: 'escalation',
        href: `/crm/account-management/work/${TASK_ID}`,
      }),
    );
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'sla.breached' }),
    );
    expect(String(notifications.insert.mock.calls[0][0].title)).toMatch(/Fix CPL/);
    expect(String(notifications.insert.mock.calls[0][0].title)).toMatch(/EduNext/);
    expect(out.escalation_level).toBe('director');
    expect(audit.calls.some((row) => row.action === 'task.escalate')).toBe(true);
    expect(repo.query.mock.calls.some(([sql]) => /crm_csd|FROM\s+csd_/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('resolve issue without category returns 400 category_required', async () => {
    repo.query.mockResolvedValue({ rows: [issueRow()], rowCount: 1 });
    await expect(
      service.resolve(viewReq as never, TASK_ID, { summary: 'Fixed' }, STAFF_ID),
    ).rejects.toMatchObject({
      status: 400,
      error: 'category_required',
    });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE/i.test(String(sql)))).toBe(false);
  });
});
