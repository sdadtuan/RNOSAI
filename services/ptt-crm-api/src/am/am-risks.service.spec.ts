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

  const RISK_ID = '19d722af-0000-4000-8000-0000000000bb';

  function mockScopedClient() {
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/FROM crm_am_account_ext/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_risks/i.test(text) && /WHERE/i.test(text)) {
        const riskId = params?.[2];
        if (riskId === RISK_ID) {
          return { rows: [{ id: RISK_ID, agency_client_id: CLIENT_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO crm_am_recovery_plans/i.test(text)) {
        return {
          rows: [
            {
              id: PLAN_ID,
              agency_client_id: CLIENT_ID,
              risk_id: RISK_ID,
              goal: 'Stabilize account',
              rca: null,
              actions_json: [],
              exit_criteria: null,
              outcome: null,
              lesson: null,
              status: 'open',
              created_at: '2026-09-05T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  it('createRecovery returns 404 risk_not_found when risk_id is not for the client', async () => {
    mockScopedClient();

    await expect(
      service.createRecovery(
        viewReq,
        { agency_client_id: CLIENT_ID, risk_id: '00000000-0000-4000-8000-000000000099', goal: 'Stabilize' },
        STAFF_ID,
      ),
    ).rejects.toMatchObject({ status: 404, error: 'risk_not_found' });
    expect(repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_am_recovery_plans/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('createRecovery succeeds when risk_id exists for same tenant and client', async () => {
    mockScopedClient();

    await expect(
      service.createRecovery(
        viewReq,
        { agency_client_id: CLIENT_ID, risk_id: RISK_ID, goal: 'Stabilize account' },
        STAFF_ID,
      ),
    ).resolves.toMatchObject({ id: PLAN_ID, risk_id: RISK_ID, goal: 'Stabilize account' });
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
