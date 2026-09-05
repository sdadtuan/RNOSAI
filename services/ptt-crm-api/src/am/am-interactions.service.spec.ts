import { AmInteractionsService } from './am-interactions.service';

const STAFF_ID = 7;
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const INTERACTION_ID = '19d722af-0000-4000-8000-0000000000aa';

describe('AmInteractionsService', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
      ],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = {
    calls: [] as Array<{ action: string }>,
    insert: jest.fn(async (row: { action: string }) => {
      audit.calls.push(row);
    }),
  };
  const tasks = {
    create: jest.fn(),
  };

  let service: AmInteractionsService;

  beforeEach(() => {
    audit.calls.length = 0;
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmInteractionsService(repo as never, staffAuth as never, audit as never, tasks as never);
  });

  it('system kind cannot PATCH', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/UPDATE/i.test(sql)) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            id: INTERACTION_ID,
            agency_client_id: CLIENT_ID,
            kind: 'system',
            occurred_at: '2026-09-04T08:00:00.000Z',
            actor_staff_id: null,
            summary: 'health.override',
            sentiment: null,
            visibility: 'internal',
            attendees_json: [],
            action_items_json: [],
            created_at: '2026-09-04T08:00:00.000Z',
          },
        ],
        rowCount: 1,
      };
    });

    await expect(
      service.patch(viewReq, INTERACTION_ID, { summary: 'edited' }, STAFF_ID),
    ).rejects.toMatchObject({
      status: 409,
      error: 'system_readonly',
    });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE/i.test(String(sql)))).toBe(false);
  });

  it('POST meeting with one ticked action item inserts interaction and creates a task', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/INSERT/i.test(text)) {
        return {
          rows: [
            {
              id: INTERACTION_ID,
              agency_client_id: CLIENT_ID,
              kind: 'meeting',
              occurred_at: '2026-09-04T15:30:00.000Z',
              actor_staff_id: STAFF_ID,
              summary: 'QBR Q3',
              sentiment: 'neutral',
              visibility: 'internal',
              attendees_json: ['Minh'],
              action_items_json: [{ title: 'Gửi recap', done: true }],
              created_at: '2026-09-04T15:31:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
    });
    tasks.create.mockResolvedValue({ id: 'task-1' });

    const out = await service.create(
      viewReq,
      {
        agency_client_id: CLIENT_ID,
        kind: 'meeting',
        occurred_at: '2026-09-04T15:30:00.000Z',
        summary: 'QBR Q3',
        attendees: ['Minh'],
        action_items: [{ title: 'Gửi recap', done: true }],
      },
      STAFF_ID,
    );

    expect(out.id).toBe(INTERACTION_ID);
    expect(repo.query.mock.calls.some(([sql]) => /INSERT\s+INTO\s+crm_am_interactions/i.test(String(sql)))).toBe(
      true,
    );
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_client_id: CLIENT_ID,
        title: 'Gửi recap',
        source: 'interaction',
        source_ref: `${INTERACTION_ID}:0`,
      }),
      STAFF_ID,
    );
    expect(audit.calls.some((row) => row.action === 'interaction.create')).toBe(true);
  });

  it('create with a done action item then toTask(0) is idempotent', async () => {
    const taskId = '19d722af-0000-4000-8000-0000000000cc';
    const createdByRef = new Map<string, string>();
    let storedItems: Array<{ title: string; done?: boolean; task_id?: string }> = [
      { title: 'Gửi recap', done: true },
    ];

    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/INSERT\s+INTO\s+crm_am_interactions/i.test(text)) {
        return {
          rows: [
            {
              id: INTERACTION_ID,
              agency_client_id: CLIENT_ID,
              kind: 'meeting',
              occurred_at: '2026-09-04T15:30:00.000Z',
              actor_staff_id: STAFF_ID,
              summary: 'QBR Q3',
              sentiment: 'neutral',
              visibility: 'internal',
              attendees_json: ['Minh'],
              action_items_json: storedItems,
              created_at: '2026-09-04T15:31:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE\s+crm_am_interactions/i.test(text) && /action_items_json/i.test(text)) {
        storedItems = JSON.parse(String(params?.[2])) as typeof storedItems;
        return { rows: [], rowCount: 1 };
      }
      if (/source_ref/i.test(text) && /dismissed_at/i.test(text)) {
        const ref = String(params?.[2] ?? '');
        const found = createdByRef.get(ref);
        return found ? { rows: [{ id: found }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (/FROM\s+crm_am_interactions/i.test(text)) {
        return {
          rows: [
            {
              id: INTERACTION_ID,
              agency_client_id: CLIENT_ID,
              kind: 'meeting',
              occurred_at: '2026-09-04T15:30:00.000Z',
              actor_staff_id: STAFF_ID,
              summary: 'QBR Q3',
              sentiment: 'neutral',
              visibility: 'internal',
              attendees_json: ['Minh'],
              action_items_json: storedItems,
              created_at: '2026-09-04T15:31:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
    });
    tasks.create.mockImplementation(async (input: { source_ref?: string }) => {
      const ref = String(input.source_ref ?? '');
      createdByRef.set(ref, taskId);
      return { id: taskId };
    });

    await service.create(
      viewReq,
      {
        agency_client_id: CLIENT_ID,
        kind: 'meeting',
        occurred_at: '2026-09-04T15:30:00.000Z',
        summary: 'QBR Q3',
        attendees: ['Minh'],
        action_items: [{ title: 'Gửi recap', done: true }],
      },
      STAFF_ID,
    );

    const again = await service.toTask(viewReq, INTERACTION_ID, 0);
    expect(again.created).toBe(false);
    expect(again.task_id).toBe(taskId);
    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'interaction',
        source_ref: `${INTERACTION_ID}:0`,
      }),
      STAFF_ID,
    );
  });

  it('creates one AM task from an action item and is idempotent', async () => {
    const interactionId = '19d722af-0000-4000-8000-0000000000aa';
    const taskId = '19d722af-0000-4000-8000-0000000000cc';
    const editReq = viewReq;
    const interactionRow = {
      id: interactionId,
      agency_client_id: CLIENT_ID,
      kind: 'note',
      occurred_at: '2026-09-04T08:00:00.000Z',
      actor_staff_id: STAFF_ID,
      summary: 'QBR',
      sentiment: null,
      visibility: 'internal',
      attendees_json: [],
      action_items_json: [{ title: 'Gửi QBR' }],
      created_at: '2026-09-04T08:00:00.000Z',
    };

    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/source_ref/i.test(text) && /dismissed_at/i.test(text)) {
        return tasks.create.mock.calls.length > 0
          ? { rows: [{ id: taskId }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (/UPDATE/i.test(text)) {
        return {
          rows: [
            {
              ...interactionRow,
              action_items_json: [{ title: 'Gửi QBR', done: true, task_id: taskId }],
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [interactionRow], rowCount: 1 };
    });
    tasks.create.mockResolvedValue({ id: taskId });

    const first = await service.toTask(editReq, interactionId, 0);
    expect(first.created).toBe(true);
    expect(first.action_items[0].task_id).toBeTruthy();
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_client_id: CLIENT_ID,
        title: 'Gửi QBR',
        kind: 'task',
        source: 'interaction',
        source_ref: `${interactionId}:0`,
      }),
      STAFF_ID,
    );
    expect(audit.calls.some((row) => row.action === 'interaction.action_item_to_task')).toBe(true);

    const second = await service.toTask(editReq, interactionId, 0);
    expect(second.created).toBe(false);
    expect(second.task_id).toBe(first.task_id);
    expect(tasks.create).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for out-of-range index', async () => {
    const interactionId = INTERACTION_ID;
    const editReq = viewReq;
    repo.query.mockResolvedValue({
      rows: [
        {
          id: interactionId,
          agency_client_id: CLIENT_ID,
          kind: 'note',
          occurred_at: '2026-09-04T08:00:00.000Z',
          actor_staff_id: STAFF_ID,
          summary: 'QBR',
          sentiment: null,
          visibility: 'internal',
          attendees_json: [],
          action_items_json: [{ title: 'Gửi QBR' }],
          created_at: '2026-09-04T08:00:00.000Z',
        },
      ],
      rowCount: 1,
    });

    await expect(service.toTask(editReq, interactionId, 9)).rejects.toMatchObject({
      status: 400,
    });
  });
});
