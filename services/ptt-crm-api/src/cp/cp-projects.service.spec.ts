import {
  decodeProjectCursor,
  encodeProjectCursor,
  projectIsAtRisk,
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
});
