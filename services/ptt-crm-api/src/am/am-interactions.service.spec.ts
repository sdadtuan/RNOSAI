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

  it('create ignores client-supplied action item task_id and still creates a real task', async () => {
    const fakeTaskId = '19d722af-0000-4000-8000-0000000000ff';
    const realTaskId = '19d722af-0000-4000-8000-0000000000cc';
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
    tasks.create.mockResolvedValue({ id: realTaskId });

    const out = await service.create(
      viewReq,
      {
        agency_client_id: CLIENT_ID,
        kind: 'meeting',
        occurred_at: '2026-09-04T15:30:00.000Z',
        summary: 'QBR Q3',
        attendees: ['Minh'],
        action_items: [{ title: 'Gửi recap', done: true, task_id: fakeTaskId }],
      },
      STAFF_ID,
    );

    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(out.action_items[0].task_id).toBe(realTaskId);
    expect(out.action_items[0].task_id).not.toBe(fakeTaskId);
    const insertCall = repo.query.mock.calls.find(([sql]) =>
      /INSERT\s+INTO\s+crm_am_interactions/i.test(String(sql)),
    );
    expect(insertCall).toBeTruthy();
    expect(JSON.stringify(insertCall?.[1])).not.toContain(fakeTaskId);
  });

  it('patch keeps stored task_id and ignores a client-supplied task_id', async () => {
    const storedTaskId = '19d722af-0000-4000-8000-0000000000cc';
    const fakeTaskId = '19d722af-0000-4000-8000-0000000000ff';
    const interactionRow = {
      id: INTERACTION_ID,
      agency_client_id: CLIENT_ID,
      kind: 'note',
      occurred_at: '2026-09-04T08:00:00.000Z',
      actor_staff_id: STAFF_ID,
      summary: 'QBR',
      sentiment: null,
      visibility: 'internal',
      attendees_json: [],
      action_items_json: [{ title: 'Gửi QBR', done: true, task_id: storedTaskId }],
      created_at: '2026-09-04T08:00:00.000Z',
    };
    let patchedJson = '';
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/UPDATE\s+crm_am_interactions/i.test(text)) {
        patchedJson = String(params?.[6] ?? '');
        return {
          rows: [{ ...interactionRow, action_items_json: JSON.parse(patchedJson) }],
          rowCount: 1,
        };
      }
      return { rows: [interactionRow], rowCount: 1 };
    });

    const out = await service.patch(
      viewReq,
      INTERACTION_ID,
      {
        action_items: [{ title: 'Gửi QBR', done: true, task_id: fakeTaskId }],
      },
      STAFF_ID,
    );

    expect(out.action_items[0].task_id).toBe(storedTaskId);
    expect(patchedJson).toContain(storedTaskId);
    expect(patchedJson).not.toContain(fakeTaskId);
  });

  it('patch does not attach a stored task_id to a different title at the same index', async () => {
    const recapTaskId = '19d722af-0000-4000-8000-0000000000aa';
    const bookTaskId = '19d722af-0000-4000-8000-0000000000bb';
    const interactionRow = {
      id: INTERACTION_ID,
      agency_client_id: CLIENT_ID,
      kind: 'note',
      occurred_at: '2026-09-04T08:00:00.000Z',
      actor_staff_id: STAFF_ID,
      summary: 'QBR',
      sentiment: null,
      visibility: 'internal',
      attendees_json: [],
      action_items_json: [
        { title: 'Gửi recap', done: true, task_id: recapTaskId },
        { title: 'Book follow-up', done: true, task_id: bookTaskId },
      ],
      created_at: '2026-09-04T08:00:00.000Z',
    };
    let patchedJson = '';
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/UPDATE\s+crm_am_interactions/i.test(text)) {
        patchedJson = String(params?.[6] ?? '');
        return {
          rows: [{ ...interactionRow, action_items_json: JSON.parse(patchedJson) }],
          rowCount: 1,
        };
      }
      return { rows: [interactionRow], rowCount: 1 };
    });

    const out = await service.patch(
      viewReq,
      INTERACTION_ID,
      {
        action_items: [
          { title: 'Book follow-up', done: true },
          { title: 'New follow-up', done: false },
        ],
      },
      STAFF_ID,
    );

    expect(out.action_items[0].title).toBe('Book follow-up');
    expect(out.action_items[0].task_id).toBe(bookTaskId);
    expect(out.action_items[0].task_id).not.toBe(recapTaskId);
    expect(out.action_items[1].title).toBe('New follow-up');
    expect(out.action_items[1].task_id).toBeUndefined();
    expect(patchedJson).toContain(bookTaskId);
    expect(patchedJson).not.toContain(recapTaskId);
  });

  it('patch assigns a stored task_id to only one incoming item when titles duplicate', async () => {
    const storedTaskId = '19d722af-0000-4000-8000-0000000000cc';
    const interactionRow = {
      id: INTERACTION_ID,
      agency_client_id: CLIENT_ID,
      kind: 'note',
      occurred_at: '2026-09-04T08:00:00.000Z',
      actor_staff_id: STAFF_ID,
      summary: 'QBR',
      sentiment: null,
      visibility: 'internal',
      attendees_json: [],
      action_items_json: [{ title: 'Follow up', done: true, task_id: storedTaskId }],
      created_at: '2026-09-04T08:00:00.000Z',
    };
    let patchedItems: Array<{ title: string; task_id?: string }> = [];
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/UPDATE\s+crm_am_interactions/i.test(text)) {
        patchedItems = JSON.parse(String(params?.[6] ?? '[]')) as typeof patchedItems;
        return {
          rows: [{ ...interactionRow, action_items_json: patchedItems }],
          rowCount: 1,
        };
      }
      return { rows: [interactionRow], rowCount: 1 };
    });

    const out = await service.patch(
      viewReq,
      INTERACTION_ID,
      {
        action_items: [
          { title: 'Follow up', done: true },
          { title: 'Follow up', done: false },
        ],
      },
      STAFF_ID,
    );

    const withStored = out.action_items.filter((item) => item.task_id === storedTaskId);
    expect(withStored).toHaveLength(1);
    expect(out.action_items[0].task_id).toBe(storedTaskId);
    expect(out.action_items[1].task_id).toBeUndefined();
    expect(patchedItems.filter((item) => item.task_id === storedTaskId)).toHaveLength(1);
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
      error: 'action_item_not_found',
    });
  });

  it.each(['0abc', '0.5'])(
    'returns 400 action_item_not_found for invalid index %s and does not create a task',
    async (badIndex) => {
      const interactionId = INTERACTION_ID;
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

      await expect(service.toTask(viewReq, interactionId, badIndex)).rejects.toMatchObject({
        status: 400,
        error: 'action_item_not_found',
      });
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it('returns 404 not_found for an inaccessible interaction even when index is 0abc', async () => {
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(service.toTask(viewReq, INTERACTION_ID, '0abc')).rejects.toMatchObject({
      status: 404,
      error: 'not_found',
    });
    expect(tasks.create).not.toHaveBeenCalled();
  });
});
