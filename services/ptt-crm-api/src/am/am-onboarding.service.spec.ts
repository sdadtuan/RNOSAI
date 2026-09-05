import { AmOnboardingService } from './am-onboarding.service';

const HANDOVER_ID = '19d722af-0000-4000-8000-0000000000aa';
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const STAFF_ID = 7;

const COMPLETE_CHECKLIST = {
  understood_scope: true,
  stakeholders_access: true,
  delivery_owner: true,
};

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

describe('AmOnboardingService handover', () => {
  const viewReq = {
    staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
    staffAuthVia: 'jwt' as const,
  } as never;

  const db: {
    query: jest.MockedFunction<QueryFn>;
    withTransaction: jest.MockedFunction<(fn: (query: QueryFn) => Promise<unknown>) => Promise<unknown>>;
  } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
    withTransaction: jest.fn(async (fn) => fn(db.query)),
  };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => STAFF_ID),
    me: jest.fn(async () => ({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_am', action: 'view_all' },
      ],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = {
    calls: [] as Array<{ action: string; entity_type?: string; entity_id?: string }>,
    insert: jest.fn(async (row: { action: string; entity_type?: string; entity_id?: string }) => {
      audit.calls.push(row);
    }),
  };

  const handoverRow = {
    id: HANDOVER_ID,
    agency_client_id: CLIENT_ID,
    status: 'pending_am',
    commercial_json: { value_vnd: 504_000_000 },
    scope_json: { kpi: '60 booking/tháng' },
    stakeholders_json: { primary: 'Lan' },
    reject_reason: null,
    accepted_by_staff_id: null,
    accepted_at: null,
    name: 'Bloom Spa',
    code: 'BL01',
    am_status: 'pending_handover',
  };

  let service: AmOnboardingService;

  beforeEach(() => {
    audit.calls.length = 0;
    jest.clearAllMocks();
    staffAuth.me.mockResolvedValue({
      caps: [
        { section: 'crm_am', action: 'view' },
        { section: 'crm_am', action: 'edit' },
        { section: 'crm_am', action: 'view_all' },
      ],
    });
    db.withTransaction.mockImplementation(async (fn) => fn(db.query));
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_am_handovers/i.test(text) && /select/i.test(text)) {
        return { rows: [handoverRow], rowCount: 1 };
      }
      if (/from crm_am_onboarding_templates/i.test(text)) {
        return {
          rows: [{ id: '19d722af-0000-4000-8000-0000000000bb', items_json: [{ title: 'Kickoff' }] }],
          rowCount: 1,
        };
      }
      if (/update crm_am_handovers/i.test(text)) {
        return { rows: [], rowCount: 1 };
      }
      if (/insert into crm_am_onboarding_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000cc' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    service = new AmOnboardingService(db as never, staffAuth as never, audit as never);
  });

  it('accept without checklist is 400', async () => {
    await expect(service.accept(viewReq, HANDOVER_ID, {}, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'checklist_required',
    });
    expect(audit.calls).toEqual([]);
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(db.query.mock.calls.some(([sql]) => /update crm_am_handovers/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('reject without reason is 400', async () => {
    await expect(service.reject(viewReq, HANDOVER_ID, {}, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'reason_required',
    });
    await expect(service.reject(viewReq, HANDOVER_ID, { reason: '   ' }, STAFF_ID)).rejects.toMatchObject({
      status: 400,
      error: 'reason_required',
    });
    expect(audit.calls).toEqual([]);
  });

  it('accept writes audit handover.accept', async () => {
    const out = await service.accept(viewReq, HANDOVER_ID, { checklist: COMPLETE_CHECKLIST }, STAFF_ID);
    expect(out.status).toBe('accepted');
    expect(out.am_status).toBe('onboarding');
    expect(out.onboarding_case_id).toBeTruthy();
    expect(audit.calls[0]).toMatchObject({
      action: 'handover.accept',
      entity_type: 'handover',
      entity_id: HANDOVER_ID,
    });
    const statusSql = db.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /update crm_am_account_ext/i.test(sql));
    expect(statusSql).toMatch(/am_status\s*=\s*'onboarding'/i);
    expect(db.withTransaction).toHaveBeenCalled();
    const handoverSql = db.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /update crm_am_handovers/i.test(sql));
    expect(handoverSql).toMatch(/status\s+IN\s*\(\s*'pending_am'\s*,\s*'needs_info'\s*\)/i);
  });

  it('accept returns 409 when concurrent/already-accepted UPDATE has rowCount 0', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_am_handovers/i.test(text) && /select/i.test(text)) {
        return { rows: [handoverRow], rowCount: 1 };
      }
      if (/update crm_am_handovers/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/insert into crm_am_onboarding_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000cc' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.accept(viewReq, HANDOVER_ID, { checklist: COMPLETE_CHECKLIST }, STAFF_ID),
    ).rejects.toMatchObject({
      status: 409,
      error: 'already_processed',
    });

    expect(
      db.query.mock.calls.some(([sql]) => /insert into crm_am_onboarding_cases/i.test(String(sql))),
    ).toBe(false);
    expect(audit.insert).not.toHaveBeenCalled();
    expect(audit.calls).toEqual([]);
  });
});
