import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AmAiService } from './am-ai.service';
import { AmController } from './am.controller';
import { AM_REQUIRED_ACTION_KEY } from './guards/staff-am.guard';

const STAFF_ID = 7;
const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const DRAFT_ID = '19d722af-0000-4000-8000-0000000000ai';

const FORBIDDEN_WRITES =
  /(?:^|[\s;(])(?:UPDATE|PATCH)\s+(?:crm_am_account_ext|clients|crm_contracts)\b/i;

describe('AmAiService', () => {
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
      caps: [{ section: 'crm_am', action: 'view' }],
    })),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };
  const audit = { insert: jest.fn() };
  const accounts = { patch: jest.fn() };

  const savedFlag = process.env.AM_AI_ENABLED;
  let service: AmAiService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AM_AI_ENABLED;
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    service = new AmAiService(repo as never, staffAuth as never, audit as never, accounts as never);
  });

  afterAll(() => {
    if (savedFlag === undefined) delete process.env.AM_AI_ENABLED;
    else process.env.AM_AI_ENABLED = savedFlag;
  });

  function mockInScopeReads(opts: { inScope?: boolean } = {}) {
    const inScope = opts.inScope !== false;
    repo.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/crm_am_account_ext/i.test(text) && /clients/i.test(text)) {
        return {
          rows: inScope ? [{ agency_client_id: CLIENT_ID, name: 'Bloom Spa' }] : [],
          rowCount: inScope ? 1 : 0,
        };
      }
      if (/crm_am_health_snapshots/i.test(text)) {
        return { rows: [{ score: 3.2, band: 'watch' }], rowCount: 1 };
      }
      if (/crm_am_tasks/i.test(text)) {
        return { rows: [{ open_tasks_count: 2 }], rowCount: 1 };
      }
      if (/crm_contracts/i.test(text)) {
        return { rows: [{ ends_on: '2026-12-31' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  }

  function mutatingCalls(): string[] {
    return repo.query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => FORBIDDEN_WRITES.test(sql) || /UPDATE\s+crm_am_account_ext|UPDATE\s+clients|UPDATE\s+crm_contracts/i.test(sql));
  }

  it('GET status is { enabled: false } when AM_AI_ENABLED is unset', () => {
    delete process.env.AM_AI_ENABLED;
    expect(service.status()).toEqual({ enabled: false });
  });

  it('POST draft when flag is unset/false returns 404 ai_disabled and writes nothing', async () => {
    delete process.env.AM_AI_ENABLED;
    await expect(
      service.draft(viewReq, { agency_client_id: CLIENT_ID, kind: 'summary' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 404, error: 'ai_disabled' });

    process.env.AM_AI_ENABLED = 'false';
    service = new AmAiService(repo as never, staffAuth as never, audit as never, accounts as never);
    await expect(
      service.draft(viewReq, { agency_client_id: CLIENT_ID, kind: 'summary' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 404, error: 'ai_disabled' });

    expect(audit.insert).not.toHaveBeenCalled();
    expect(accounts.patch).not.toHaveBeenCalled();
    expect(mutatingCalls()).toEqual([]);
    expect(repo.query).not.toHaveBeenCalled();
  });

  it('POST draft when flag is on returns draft + evidence and never patches accounts', async () => {
    process.env.AM_AI_ENABLED = 'true';
    mockInScopeReads();
    const out = await service.draft(
      viewReq,
      { agency_client_id: CLIENT_ID, kind: 'health', prompt: 'chi tiết band' },
      STAFF_ID,
    );
    expect(out.draft).toEqual(expect.any(String));
    expect(out.draft.length).toBeGreaterThan(0);
    expect(out.evidence).toEqual(
      expect.objectContaining({
        health_score: 3.2,
        band: 'watch',
        open_tasks_count: 2,
        ends_on: '2026-12-31',
      }),
    );
    expect(out.draft_id).toEqual(expect.any(String));
    expect(accounts.patch).not.toHaveBeenCalled();
    expect(mutatingCalls()).toEqual([]);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai.draft',
        payload_json: expect.objectContaining({ evidence: expect.anything() }),
      }),
    );
  });

  it('POST draft rejects invalid kind with 400', async () => {
    process.env.AM_AI_ENABLED = '1';
    await expect(
      service.draft(viewReq, { agency_client_id: CLIENT_ID, kind: 'poem' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 400, error: 'invalid_kind' });
    expect(audit.insert).not.toHaveBeenCalled();
    expect(accounts.patch).not.toHaveBeenCalled();
  });

  it('POST draft for out-of-scope client returns 404', async () => {
    process.env.AM_AI_ENABLED = 'yes';
    mockInScopeReads({ inScope: false });
    await expect(
      service.draft(viewReq, { agency_client_id: CLIENT_ID, kind: 'qbr' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 404, error: 'not_found' });
    expect(audit.insert).not.toHaveBeenCalled();
    expect(accounts.patch).not.toHaveBeenCalled();
    expect(mutatingCalls()).toEqual([]);
  });

  it('POST feedback when flag is off returns 404 ai_disabled', async () => {
    await expect(
      service.feedback(viewReq, { kind: 'summary', rating: 'up' }, STAFF_ID),
    ).rejects.toMatchObject({ status: 404, error: 'ai_disabled' });
    expect(audit.insert).not.toHaveBeenCalled();
  });

  it('POST feedback when flag is on audits ai.feedback', async () => {
    process.env.AM_AI_ENABLED = 'ON';
    const out = await service.feedback(
      viewReq,
      { draft_id: DRAFT_ID, kind: 'followup', rating: 'down' },
      STAFF_ID,
    );
    expect(out).toEqual(expect.objectContaining({ ok: true }));
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai.feedback',
        payload_json: expect.objectContaining({ rating: 'down', kind: 'followup' }),
      }),
    );
  });
});

describe('AmController AI routes', () => {
  it('exposes status/draft/feedback with crm_am view', () => {
    const proto = AmController.prototype as unknown as Record<string, object>;

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.getAiStatus) ?? '')).toBe('ai/status');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getAiStatus)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.getAiStatus)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createAiDraft) ?? '')).toBe('ai/draft');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createAiDraft)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createAiDraft)).toBe('view');

    expect(String(Reflect.getMetadata(PATH_METADATA, proto.createAiFeedback) ?? '')).toBe('ai/feedback');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.createAiFeedback)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AM_REQUIRED_ACTION_KEY, proto.createAiFeedback)).toBe('view');
  });
});
