import { AmRisksService } from './am-risks.service';

const STAFF_ID = 7;
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const PLAN_ID = '19d722af-0000-4000-8000-0000000000aa';

describe('AmRisksService', () => {
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
    insert: jest.fn(),
  };

  let service: AmRisksService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmRisksService(repo as never, staffAuth as never, audit as never);
  });

  it('rejects close without lesson with 400 lesson_required and does not update', async () => {
    await expect(
      service.close(viewReq, PLAN_ID, { outcome: 'Khách giữ', lesson: '   ' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 400, error: 'lesson_required' });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE/i.test(String(sql)) && /status/i.test(String(sql)))).toBe(
      false,
    );
  });
});
