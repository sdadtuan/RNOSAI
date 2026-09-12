import {
  decodeProjectCursor,
  encodeProjectCursor,
  mapProjectProgress,
  projectIsAtRisk,
  projectProgressPct,
  CpProjectsService,
} from './cp-projects.service';

const UNKNOWN = '19d722af-0000-4000-8000-000000000099';
const id = '19d722af-0000-4000-8000-000000000001';
const CLIENT_ID = '19d722af-0000-4000-8000-000000000002';
const scope = { scope: 'me' as const, staffId: 7 };

describe('CpProjectsService', () => {
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })),
  };
  const transaction = jest.fn(
    async (work: (tx: { query: jest.MockedFunction<QueryFn> }) => Promise<unknown>) =>
      work(repo),
  );
  const audit = { insert: jest.fn(async () => undefined) };
  let svc: CpProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    svc = new CpProjectsService({ ...repo, transaction } as never, audit as never);
  });

  it('lookups lists live clients, staff, and lifecycles for PRJ-02 selects', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM clients/i.test(sql)) {
        return { rows: [{ id: CLIENT_ID, name: 'PTT', industry: 'agency' }], rowCount: 1 };
      }
      if (/FROM crm_staff/i.test(sql)) {
        return { rows: [{ id: 5, name: 'Quản trị hệ thống', job_title: 'Admin' }], rowCount: 1 };
      }
      if (/FROM crm_service_lifecycle/i.test(sql)) {
        return { rows: [{ id: 1, service_slug: 'meta-lead-gen' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.lookups()).resolves.toEqual({
      clients: [{ id: CLIENT_ID, name: 'PTT', industry: 'agency' }],
      staff: [{ id: 5, name: 'Quản trị hệ thống', job_title: 'Admin' }],
      lifecycles: [{ id: '1', service_slug: 'meta-lead-gen' }],
    });
    expect(repo.query.mock.calls[0][0]).toMatch(/FROM clients/i);
    expect(repo.query.mock.calls.some(([sql]) => /archived|offboarding/i.test(String(sql)))).toBe(true);
  });

  it('create inserts selected project members after the project row', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM clients/i.test(sql)) return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      if (/INSERT INTO crm_cp_projects/i.test(sql)) {
        return { rows: [{ id, agency_client_id: CLIENT_ID, owner_staff_id: 5, name: 'PTT' }], rowCount: 1 };
      }
      if (/FROM crm_staff/i.test(sql)) return { rows: [{ id: 4 }], rowCount: 1 };
      if (/INSERT INTO crm_cp_project_members/i.test(sql)) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await expect(
      svc.create({
        name: 'PTT',
        agency_client_id: CLIENT_ID,
        owner_staff_id: 5,
        member_staff_ids: [4],
      } as any),
    ).resolves.toMatchObject({ id });
    const memberIds = repo.query.mock.calls
      .filter(([sql]) => /INSERT INTO crm_cp_project_members/i.test(String(sql)))
      .map(([, params]) => params?.[1]);
    expect(memberIds).toEqual(expect.arrayContaining([5, 4]));
  });

  it('rejects create without agency_client_id', async () => {
    await expect(svc.create({ name: 'X', owner_staff_id: 1 } as any)).rejects.toMatchObject({
      status: 400,
    });
  });
  it('unknown client returns client_not_found', async () => {
    await expect(
      svc.create({ name: 'X', agency_client_id: UNKNOWN, owner_staff_id: 1 }),
    ).rejects.toMatchObject({ response: { error: 'client_not_found' } });
  });
  it('getProject other book is 404 not 403', async () => {
    await expect(svc.get(id, { scope: 'me', staffId: 99 })).rejects.toMatchObject({ status: 404 });
  });

  it('closes through one transaction and audits with its query port', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 100 }],
          rowCount: 1,
        };
      }
      if (/FROM crm_cp_deliverables/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/UPDATE crm_cp_projects/i.test(sql)) {
        return { rows: [{ id, status: 'completed' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.close(id, {}, scope, 7)).resolves.toMatchObject({ status: 'completed' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.close' }),
      expect.objectContaining({ query: repo.query }),
    );
  });

  it('rejects close with pending deliverables unless archival is requested', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, status: 'active', owner_staff_id: 7 }], rowCount: 1 };
      }
      if (/FROM crm_cp_deliverables/i.test(sql)) {
        return { rows: [{ id: UNKNOWN }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.close(id, {}, scope, 7)).rejects.toMatchObject({
      status: 409,
      response: { error: 'pending_deliverables' },
    });
  });

  it('marks risk for overdue work or eighty-percent credit usage', () => {
    expect(projectIsAtRisk({ overdue: true, credit_used: 0 }, 100)).toBe(true);
    expect(projectIsAtRisk({ overdue: false, credit_used: 80 }, 100)).toBe(true);
    expect(projectIsAtRisk({ overdue: false, credit_used: 79 }, 100)).toBe(false);
  });

  it('encodes both sort keys and applies a tuple cursor predicate', async () => {
    const createdAt = '2026-09-07T01:00:00.000Z';
    const cursor = encodeProjectCursor({ created_at: createdAt, id });
    expect(decodeProjectCursor(cursor)).toEqual({ created_at: createdAt, id });
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await svc.list({ ...scope, cursor });

    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('(p.created_at, p.id) <');
    expect(params).toEqual(expect.arrayContaining([createdAt, id]));
  });

  it('computes progress_pct from deliverable counts', () => {
    expect(projectProgressPct(8, 13)).toBe(62);
    expect(projectProgressPct(0, 0)).toBe(0);
    expect(mapProjectProgress({ deliverable_done: 3, deliverable_total: 4, name: 'Demo' })).toEqual(
      expect.objectContaining({ name: 'Demo', progress_pct: 75 }),
    );
  });

  it('lists PRJ-01 rows with client name, owner name, deliverable counts, and credit used', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\)::int AS project_count/i.test(sql)) {
        return {
          rows: [{
            project_count: 1,
            deliverable_done: 8,
            credit_at_risk: 1,
            draft: 0,
            active: 1,
            at_risk: 0,
            in_review: 0,
            completed: 0,
            archived: 0,
          }],
          rowCount: 1,
        };
      }
      if (/JOIN clients/i.test(sql)) {
        return {
          rows: [{
            id,
            name: 'PTT',
            agency_client_id: CLIENT_ID,
            client_name: 'PTT',
            lifecycle_id: '1',
            lifecycle_name: 'meta-lead-gen',
            owner_staff_id: 5,
            owner_name: 'Quản trị hệ thống',
            status: 'active',
            due_at: '2026-09-30',
            credit_budget: 2000,
            credit_used: 1600,
            deliverable_done: 8,
            deliverable_total: 13,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.list({ ...scope, scope: 'all' })).resolves.toMatchObject({
      items: [expect.objectContaining({
        name: 'PTT',
        client_name: 'PTT',
        owner_name: 'Quản trị hệ thống',
        deliverable_done: 8,
        deliverable_total: 13,
        progress_pct: 62,
        credit_used: 1600,
      })],
      summary: {
        project_count: 1,
        deliverable_done: 8,
        credit_at_risk: 1,
        status_counts: expect.objectContaining({ all: 1, active: 1 }),
      },
    });
    const [sql] = repo.query.mock.calls[0];
    expect(sql).toMatch(/JOIN clients/i);
    expect(sql).toMatch(/crm_staff/i);
    expect(sql).toMatch(/crm_cp_deliverables/i);
    expect(sql).toMatch(/crm_cp_credit_ledger/i);
  });

  it('filters PRJ-01 by client name and owner without requiring UUIDs', async () => {
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await svc.list({ ...scope, scope: 'all', client: 'PTT', owner: 'Quản trị' });
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toMatch(/c\.name ILIKE/i);
    expect(sql).toMatch(/s\.name ILIKE/i);
    expect(params).toEqual(expect.arrayContaining(['%PTT%', '%Quản trị%']));
  });

  it('serializes brief versions and increments one then two', async () => {
    let version = 0;
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, owner_staff_id: 7 }], rowCount: 1 };
      }
      if (/INSERT INTO crm_cp_briefs/i.test(sql)) {
        version += 1;
        return { rows: [{ id: `${id}-${version}`, version }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.addBrief(id, { body_json: { n: 1 } }, scope, 7)).resolves.toMatchObject({
      version: 1,
    });
    await expect(svc.addBrief(id, { body_json: { n: 2 } }, scope, 7)).resolves.toMatchObject({
      version: 2,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(repo.query.mock.calls.filter(([sql]) => /FOR UPDATE/i.test(sql))).toHaveLength(2);
  });

  it('returns lifecycle_not_found before create insert', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM clients/i.test(sql)) return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      if (/FROM crm_service_lifecycle/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO crm_cp_projects/i.test(sql)) {
        return { rows: [{ id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      svc.create({
        name: 'X',
        agency_client_id: CLIENT_ID,
        owner_staff_id: 7,
        lifecycle_id: '999999',
      }),
    ).rejects.toMatchObject({ status: 400, response: { error: 'lifecycle_not_found' } });
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_cp_projects/i.test(sql)),
    ).toBe(false);
  });

  it.each(['completed', 'archived'])('rejects PATCH status=%s with use_close', async (status) => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, status: 'active', owner_staff_id: 7, name: 'X', tags: [] }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.patch(id, { status }, scope)).rejects.toMatchObject({
      status: 400,
      response: { error: 'use_close' },
    });
    expect(
      repo.query.mock.calls.some(([sql]) => /UPDATE crm_cp_projects/i.test(sql)),
    ).toBe(false);
  });

  it('guards the at-risk update against terminal project status', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT p\.\* FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 100 }],
          rowCount: 1,
        };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: true, credit_used: 0 }], rowCount: 1 };
      }
      if (/UPDATE crm_cp_projects/i.test(sql)) {
        return { rows: [{ id, status: 'at_risk' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await svc.get(id, scope);

    const updateSql = repo.query.mock.calls.find(([sql]) =>
      /UPDATE crm_cp_projects/i.test(sql),
    )?.[0];
    expect(updateSql).toContain("status NOT IN ('completed', 'archived')");
  });

  it('rejects addDeliverable on a completed project with project_closed', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, status: 'completed', owner_staff_id: 7 }],
          rowCount: 1,
        };
      }
      if (/INSERT INTO crm_cp_deliverables/i.test(sql)) {
        return { rows: [{ id: UNKNOWN }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      svc.addDeliverable(id, { type: 'social' }, scope),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: 'project_closed' },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(repo.query.mock.calls.some(([sql]) => /FOR UPDATE/i.test(sql))).toBe(true);
    expect(
      repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_cp_deliverables/i.test(sql)),
    ).toBe(false);
  });

  it('get returns named client/owner/members and credit used for PRJ-03', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT p\.\* FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 1600 }],
          rowCount: 1,
        };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: false, credit_used: 200 }], rowCount: 1 };
      }
      if (/c\.name AS client_name/i.test(sql)) {
        return {
          rows: [{
            id,
            status: 'active',
            owner_staff_id: 7,
            credit_budget: 1600,
            client_name: 'PTT-HCM',
            owner_name: 'Quản trị hệ thống',
            lifecycle_name: 'meta-lead-gen',
            credit_used: 200,
            deliverable_done: 0,
            deliverable_total: 0,
          }],
          rowCount: 1,
        };
      }
      if (/FROM crm_cp_project_members/i.test(sql)) {
        return {
          rows: [{ staff_id: 5, role: 'owner', name: 'Quản trị hệ thống' }],
          rowCount: 1,
        };
      }
      if (/AS video_final/i.test(sql)) {
        return { rows: [{ video_final: 0, overdue_deliverables: 0 }], rowCount: 1 };
      }
      if (/FROM crm_cp_credit_ledger/i.test(sql)) {
        return { rows: [{ kind: 'charge', amount: 200, cost_center: 'video' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.get(id, scope)).resolves.toMatchObject({
      client_name: 'PTT-HCM',
      owner_name: 'Quản trị hệ thống',
      credit_used: 200,
      credit_charged: 200,
      members: [{ staff_id: 5, role: 'owner', name: 'Quản trị hệ thống' }],
    });
  });

  it('returns null AI Ops chip counts when weave and provider job queries have 0 rows', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT p\.\* FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 100 }], rowCount: 1 };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: false, credit_used: 0 }], rowCount: 1 };
      }
      if (/crm_cp_weave_work_orders|provider LIKE 'magnific%'|provider = 'comfyui'/i.test(sql)) {
        return { rows: [{ weave_open: 0, magnific_jobs: 0, comfy_jobs: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.get(id, scope)).resolves.toMatchObject({
      weave_open_count: null,
      magnific_job_count: null,
      comfy_job_count: null,
    });
  });

  it('queries open weave WOs and magnific/comfy jobs for PRJ-03 chips', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT p\.\* FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 100 }], rowCount: 1 };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: false, credit_used: 0 }], rowCount: 1 };
      }
      if (/crm_cp_weave_work_orders/i.test(sql)) {
        return { rows: [{ weave_open: 2 }], rowCount: 1 };
      }
      if (/provider LIKE 'magnific%'|provider = 'comfyui'/i.test(sql)) {
        return { rows: [{ magnific_jobs: 3, comfy_jobs: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.get(id, scope)).resolves.toMatchObject({
      weave_open_count: 2,
      magnific_job_count: 3,
      comfy_job_count: 1,
    });
    const sql = repo.query.mock.calls.map(([text]) => String(text)).join('\n');
    expect(sql).toMatch(/crm_cp_weave_work_orders/);
    expect(sql).toMatch(/status NOT IN \('cancelled', 'delivered'\)/);
    expect(sql).toMatch(/provider LIKE 'magnific%'/);
    expect(sql).toMatch(/provider = 'comfyui'/);
  });

  it('fail-closes weave open count when the work-order table is missing', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT p\.\* FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, status: 'active', owner_staff_id: 7, credit_budget: 100 }], rowCount: 1 };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: false, credit_used: 0 }], rowCount: 1 };
      }
      if (/crm_cp_weave_work_orders/i.test(sql)) {
        throw Object.assign(new Error('relation "crm_cp_weave_work_orders" does not exist'), {
          code: '42P01',
        });
      }
      if (/provider LIKE 'magnific%'|provider = 'comfyui'/i.test(sql)) {
        return { rows: [{ magnific_jobs: 3, comfy_jobs: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.get(id, scope)).resolves.toMatchObject({
      weave_open_count: null,
      magnific_job_count: 3,
      comfy_job_count: 1,
    });
  });

  it('lists deliverables and tasks with staff names', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return { rows: [{ id, status: 'active', owner_staff_id: 7 }], rowCount: 1 };
      }
      if (/AS overdue/i.test(sql)) {
        return { rows: [{ overdue: false, credit_used: 0 }], rowCount: 1 };
      }
      if (/FROM crm_cp_deliverables/i.test(sql) && /owner_name/i.test(sql)) {
        return {
          rows: [{ id: UNKNOWN, type: 'ai_video', owner_staff_id: 4, owner_name: 'Đặng Công Quốc' }],
          rowCount: 1,
        };
      }
      if (/FROM crm_cp_tasks/i.test(sql) && /assignee_name/i.test(sql)) {
        return {
          rows: [{ id: UNKNOWN, title: 'Khóa VO', assignee_id: 4, assignee_name: 'Đặng Công Quốc' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.listDeliverables(id, scope)).resolves.toMatchObject({
      items: [{ owner_name: 'Đặng Công Quốc' }],
    });
    await expect(svc.listTasks(id, scope)).resolves.toMatchObject({
      items: [{ assignee_name: 'Đặng Công Quốc' }],
    });
  });
});

describe('CpProjectsService.submitCreative', () => {
  const VERSION_ID = '19d722af-0000-4000-8000-000000000003';
  const CREATIVE_ID = '19d722af-0000-4000-8000-000000000004';
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })),
  };
  const transaction = jest.fn(
    async (work: (tx: { query: jest.MockedFunction<QueryFn> }) => Promise<unknown>) =>
      work(repo),
  );
  const audit = { insert: jest.fn(async () => undefined) };
  const creatives = { submit: jest.fn() };
  const videos = { getVersion: jest.fn() };
  let svc: CpProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    svc = new CpProjectsService(
      { ...repo, transaction } as never,
      audit as never,
      creatives as never,
      videos as never,
    );
  });

  it('rejects a missing version with 400', async () => {
    await expect(svc.submitCreative(id, '', scope)).rejects.toMatchObject({
      status: 400,
    });
    expect(creatives.submit).not.toHaveBeenCalled();
  });

  it('returns creative_id after Hub submit', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [
            {
              id,
              name: 'Spring launch',
              agency_client_id: CLIENT_ID,
              status: 'active',
              owner_staff_id: 7,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    videos.getVersion.mockResolvedValue({
      id: VERSION_ID,
      project_id: id,
      draft_name: 'Cut v2',
      version_n: 2,
      output_uri: 's3://cp/final.mp4',
      qc_status: 'passed',
    });
    creatives.submit.mockResolvedValue({
      ok: true,
      creative: { id: CREATIVE_ID, title: 'Cut v2' },
    });

    await expect(svc.submitCreative(id, VERSION_ID, scope)).resolves.toEqual({
      creative_id: CREATIVE_ID,
    });
    expect(creatives.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: CLIENT_ID,
        title: 'Cut v2',
        description: `cp_version:${VERSION_ID}`,
        asset_url: 's3://cp/final.mp4',
        asset_type: 'video',
      }),
    );
  });

  it('blocks Hub submit when the version QC is blocked', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_projects p/i.test(sql)) {
        return {
          rows: [{ id, name: 'X', agency_client_id: CLIENT_ID, status: 'active' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    videos.getVersion.mockResolvedValue({
      id: VERSION_ID,
      project_id: id,
      qc_status: 'blocked',
    });

    await expect(svc.submitCreative(id, VERSION_ID, scope)).rejects.toMatchObject({
      status: 409,
      response: { error: 'qc_blocked' },
    });
    expect(creatives.submit).not.toHaveBeenCalled();
  });

  it('imports each Dự án PTT row once and owns it as the actor', async () => {
    const b2bId = 'da5de896-1721-47e9-b645-e6b499b5dc04';
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_b2b_projects/i.test(sql) && !/crm_b2b_project_staff/i.test(sql)) {
        return {
          rows: [{ id: b2bId, code: 'ptt-hcm', name: 'PTT', status: 'active' }],
          rowCount: 1,
        };
      }
      if (/tags @>/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO clients/i.test(sql)) {
        return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      }
      if (/FROM clients/i.test(sql)) return { rows: [{ id: CLIENT_ID }], rowCount: 1 };
      if (/FROM crm_staff/i.test(sql)) return { rows: [{ id: 5 }], rowCount: 1 };
      if (/INSERT INTO crm_cp_projects/i.test(sql)) {
        return {
          rows: [{ id, name: 'PTT', agency_client_id: CLIENT_ID, owner_staff_id: 5, status: 'active' }],
          rowCount: 1,
        };
      }
      if (/FROM crm_b2b_project_staff/i.test(sql)) {
        return { rows: [{ staff_id: 4 }], rowCount: 1 };
      }
      if (/INSERT INTO crm_cp_project_members/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.importFromB2b(5)).resolves.toMatchObject({
      created: [expect.objectContaining({ id, name: 'PTT' })],
      skipped: 0,
    });
    const projectInsert = repo.query.mock.calls.find(([sql]) =>
      /INSERT INTO crm_cp_projects/i.test(String(sql)),
    );
    expect(projectInsert?.[1]).toEqual(
      expect.arrayContaining([CLIENT_ID, 5, 'PTT', 'active']),
    );
    const memberStaffIds = repo.query.mock.calls
      .filter(([sql]) => /INSERT INTO crm_cp_project_members/i.test(String(sql)))
      .map(([, params]) => params?.[1]);
    expect(memberStaffIds).toEqual(expect.arrayContaining([5, 4]));
  });

  it('skips a Dự án PTT row already tagged on a CP project', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_b2b_projects/i.test(sql) && !/crm_b2b_project_staff/i.test(sql)) {
        return {
          rows: [{ id: 'da5de896-1721-47e9-b645-e6b499b5dc04', code: 'ptt-hcm', name: 'PTT' }],
          rowCount: 1,
        };
      }
      if (/tags @>/i.test(sql)) return { rows: [{ id }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await expect(svc.importFromB2b(5)).resolves.toEqual({ created: [], skipped: 1 });
    expect(repo.query.mock.calls.some(([sql]) => /INSERT INTO crm_cp_projects/i.test(String(sql)))).toBe(
      false,
    );
  });
});
