import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AM_FEEDBACK_CLIENTS_JOIN, AmFeedbackService } from './am-feedback.service';
import { AmController } from './am.controller';
import { AM_REQUIRED_ACTION_KEY } from './guards/staff-am.guard';

const STAFF_ID = 7;
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const UNKNOWN_ID = '19d722af-0000-4000-8000-000000000099';
const FEEDBACK_ID = '19d722af-0000-4000-8000-0000000000fb';
const TASK_ID = '19d722af-0000-4000-8000-0000000000aa';
const CSD_ID = '19d722af-0000-4000-8000-0000000000cd';
const DAY_MS = 24 * 60 * 60 * 1000;

describe('AmFeedbackService', () => {
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
  const audit = { insert: jest.fn() };
  const tasks = { create: jest.fn() };
  const csd = { resolve: jest.fn() };

  let service: AmFeedbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    tasks.create.mockResolvedValue({
      id: TASK_ID,
      source: 'survey',
      source_ref: FEEDBACK_ID,
      due_at: new Date(Date.now() + DAY_MS).toISOString(),
    });
    service = new AmFeedbackService(repo as never, staffAuth as never, audit as never, tasks as never);
  });

  function insertedFeedback(overrides: Record<string, unknown> = {}) {
    return {
      id: FEEDBACK_ID,
      agency_client_id: CLIENT_ID,
      account_name: 'Bloom Spa',
      kind: 'csat',
      score: 3,
      comment: 'Chậm cuối tuần',
      followup_task_id: null,
      created_at: '2026-09-05T00:00:00.000Z',
      ...overrides,
    };
  }

  function mockClientAndInsert(insertRow: Record<string, unknown> = insertedFeedback()) {
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/FROM clients/i.test(text)) {
        return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_account_ext/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_surveys/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO crm_am_feedback/i.test(text)) {
        return { rows: [insertRow], rowCount: 1 };
      }
      if (/UPDATE crm_am_tasks/i.test(text)) {
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE crm_am_feedback/i.test(text)) {
        return { rows: [{ ...insertRow, followup_task_id: TASK_ID }], rowCount: 1 };
      }
      if (/FROM crm_am_feedback/i.test(text)) {
        return { rows: [insertRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  it('POST csat score 3 inserts a survey task due in ~24h and sets followup_task_id', async () => {
    const before = Date.now();
    mockClientAndInsert(insertedFeedback({ score: 3 }));

    const out = await service.create(
      viewReq,
      { agency_client_id: CLIENT_ID, kind: 'csat', score: 3, comment: 'Chậm cuối tuần' },
      STAFF_ID,
    );

    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_client_id: CLIENT_ID,
        source: 'survey',
        source_ref: FEEDBACK_ID,
        title: expect.stringMatching(/CSAT thấp/i),
      }),
      STAFF_ID,
    );
    const dueRaw = String(tasks.create.mock.calls[0][0].due_at ?? '');
    const dueMs = Date.parse(dueRaw);
    expect(Number.isFinite(dueMs)).toBe(true);
    expect(Math.abs(dueMs - (before + DAY_MS))).toBeLessThan(8_000);
    expect(out.followup_task_id).toBe(TASK_ID);
    expect(
      repo.query.mock.calls.some(([sql]) => /UPDATE crm_am_feedback/i.test(String(sql))),
    ).toBe(true);
  });

  it('POST csat score 4 does not insert a task', async () => {
    mockClientAndInsert(insertedFeedback({ score: 4, followup_task_id: null }));

    const out = await service.create(
      viewReq,
      { agency_client_id: CLIENT_ID, kind: 'csat', score: 4 },
      STAFF_ID,
    );

    expect(tasks.create).not.toHaveBeenCalled();
    expect(out.followup_task_id).toBeNull();
    expect(
      repo.query.mock.calls.some(([sql]) => /UPDATE crm_am_feedback/i.test(String(sql))),
    ).toBe(false);
  });

  it('followup returns 409 already_followed_up when a task is already set', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/FROM crm_am_feedback/i.test(text)) {
        return {
          rows: [insertedFeedback({ followup_task_id: TASK_ID })],
          rowCount: 1,
        };
      }
      if (/FROM crm_am_account_ext/i.test(text)) {
        return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.followup(viewReq, FEEDBACK_ID, STAFF_ID)).rejects.toMatchObject({
      status: 409,
      error: 'already_followed_up',
    });
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('list and loadOne SQL inner-join clients so orphan feedback is dropped', async () => {
    await service.list(viewReq, {});
    const listSql = repo.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /FROM crm_am_feedback/i.test(sql));
    expect(listSql).toMatch(/INNER JOIN clients/i);
    expect(listSql).toContain(AM_FEEDBACK_CLIENTS_JOIN);

    repo.query.mockClear();
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_am_feedback/i.test(String(sql))) {
        return { rows: [insertedFeedback({ followup_task_id: null })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    await service.followup(viewReq, FEEDBACK_ID, STAFF_ID);
    const oneSql = repo.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /FROM crm_am_feedback/i.test(sql) && /f\.id = \$2/i.test(sql));
    expect(oneSql).toMatch(/INNER JOIN clients/i);
    expect(oneSql).toContain(AM_FEEDBACK_CLIENTS_JOIN);
  });

  it('POST complaint + csd_ticket_id creates a survey task and stores the CSD link', async () => {
    mockClientAndInsert(insertedFeedback({ kind: 'complaint', score: null }));

    const out = await service.create(
      viewReq,
      {
        agency_client_id: CLIENT_ID,
        kind: 'complaint',
        comment: 'CPL tăng',
        csd_ticket_id: CSD_ID,
      },
      STAFF_ID,
    );

    expect(csd.resolve).not.toHaveBeenCalled();
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_client_id: CLIENT_ID,
        source: 'survey',
        source_ref: FEEDBACK_ID,
      }),
      STAFF_ID,
    );
    expect(
      repo.query.mock.calls.some(
        ([sql, params]) =>
          /UPDATE crm_am_tasks SET csd_ticket_id/i.test(String(sql)) &&
          Array.isArray(params) &&
          params.includes(CSD_ID),
      ),
    ).toBe(true);
    expect(out.csd_ticket_id).toBe(CSD_ID);
    expect(out.followup_task_id).toBe(TASK_ID);
    expect(out.csd_href).toBe(`/crm/csd/tickets/${CSD_ID}`);
  });

  it('complaint without a ticket does not call CSD resolve or insert a task', async () => {
    mockClientAndInsert(insertedFeedback({ kind: 'complaint', score: null }));

    await service.create(
      viewReq,
      { agency_client_id: CLIENT_ID, kind: 'complaint', comment: 'CPL tăng' },
      STAFF_ID,
    );

    expect(csd.resolve).not.toHaveBeenCalled();
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('POST unknown client returns 400 client_not_found and does not insert', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM clients/i.test(String(sql))) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.create(viewReq, { agency_client_id: UNKNOWN_ID, kind: 'csat', score: 3 }, STAFF_ID),
    ).rejects.toMatchObject({ status: 400, error: 'client_not_found' });
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_am_feedback/i.test(String(sql))),
    ).toBe(false);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('rejects invalid UUID with 400', async () => {
    await expect(
      service.create(viewReq, { agency_client_id: 'not-a-uuid', kind: 'csat', score: 2 }, STAFF_ID),
    ).rejects.toMatchObject({ status: 400 });
    expect(tasks.create).not.toHaveBeenCalled();
  });
});

describe('AmController feedback routes', () => {
  it('exposes GET/POST feedback and followup with view/edit caps', () => {
    const proto = AmController.prototype as unknown as Record<string, object>;
    expect(String(Reflect.getMetadata(PATH_METADATA, proto.listFeedback) ?? '')).toBe('feedback');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.listFeedback)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.listFeedback)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createFeedback) ?? '')).toBe('feedback');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createFeedback)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createFeedback)).toBe('edit');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.followupFeedback) ?? '')).toBe(
      'feedback/:id/followup',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, proto.followupFeedback)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.followupFeedback)).toBe('edit');
  });

  it('exposes GET/POST surveys with view/edit caps', () => {
    const proto = AmController.prototype as unknown as Record<string, object>;
    expect(String(Reflect.getMetadata(PATH_METADATA, proto.listSurveys) ?? '')).toBe('surveys');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.listSurveys)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.listSurveys)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createSurvey) ?? '')).toBe('surveys');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createSurvey)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createSurvey)).toBe('edit');
  });
});
