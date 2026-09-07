import { CpProjectsService } from './cp-projects.service';

const UNKNOWN = '19d722af-0000-4000-8000-000000000099';
const id = '19d722af-0000-4000-8000-000000000001';

describe('CpProjectsService', () => {
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })),
  };
  const audit = { insert: jest.fn(async () => undefined) };
  let svc: CpProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });
    svc = new CpProjectsService(repo as never, audit as never);
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
});
