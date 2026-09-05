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
        source_ref: `interaction:${INTERACTION_ID}:0`,
      }),
      STAFF_ID,
    );
    expect(audit.calls.some((row) => row.action === 'interaction.create')).toBe(true);
  });
});
