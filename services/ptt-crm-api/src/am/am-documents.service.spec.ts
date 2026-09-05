import { AmDocumentsService } from './am-documents.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const OUT_OF_SCOPE_ID = '19d722af-0000-4000-8000-000000000099';

const viewReq = {
  staffUser: { sub: '19d722af-0000-4000-8000-000000000007' },
  staffAuthVia: 'jwt' as const,
} as never;

describe('AmDocumentsService', () => {
  const db = { query: jest.fn() };
  const staffAuth = {
    resolveCrmStaffUserId: jest.fn(async () => 7),
    me: jest.fn(async () => ({ caps: [{ section: 'crm_am', action: 'edit' }] })),
    hasCap: jest.fn(() => true),
  };

  it('rejects non-http(s) and non-root-relative href', async () => {
    db.query.mockReset();
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    await expect(
      svc.create(
        viewReq,
        { agency_client_id: CLIENT_ID, title: 'X', href: 'javascript:alert(1)' },
        7,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('inserts a link scoped to the account', async () => {
    db.query.mockReset();
    db.query.mockImplementation(async (sql: string) => {
      if (/INSERT/i.test(String(sql))) {
        return {
          rows: [{
            id: '19d722af-0000-4000-8000-0000000000aa',
            agency_client_id: CLIENT_ID,
            contract_id: null,
            onboarding_case_id: null,
            interaction_id: null,
            title: 'Kickoff',
            kind: 'link',
            href: 'https://docs.ptt.example/kickoff',
            created_by_staff_id: 7,
            created_at: '2026-09-05T00:00:00.000Z',
          }],
          rowCount: 1,
        };
      }
      return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
    });
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    const row = await svc.create(
      viewReq,
      { agency_client_id: CLIENT_ID, title: 'Kickoff', href: 'https://docs.ptt.example/kickoff' },
      7,
    );
    expect(row.kind).toBe('link');
    expect(
      db.query.mock.calls.some(([sql]) => /insert into crm_am_documents/i.test(String(sql))),
    ).toBe(true);
  });

  it('create returns 404 when the account is out of scope', async () => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    await expect(
      svc.create(
        viewReq,
        {
          agency_client_id: OUT_OF_SCOPE_ID,
          title: 'Kickoff',
          href: 'https://docs.ptt.example/kickoff',
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 404, error: 'not_found' });
    expect(
      db.query.mock.calls.some(([sql]) => /insert into crm_am_documents/i.test(String(sql))),
    ).toBe(false);
  });

  it('returns empty list when documents table is missing', async () => {
    db.query.mockReset();
    db.query.mockRejectedValue({ code: '42P01', message: 'relation "crm_am_documents" does not exist' });
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    await expect(
      svc.list(
        { staffUser: { sub: '19d722af-0000-4000-8000-000000000007' }, staffAuthVia: 'jwt' } as never,
        { agency_client_id: CLIENT_ID },
      ),
    ).resolves.toEqual({ items: [] });
  });

  it('create throws 503 when documents table is missing', async () => {
    db.query.mockReset();
    db.query.mockImplementation(async (sql: string) => {
      if (/INSERT/i.test(String(sql))) {
        throw { code: '42P01', message: 'relation "crm_am_documents" does not exist' };
      }
      return { rows: [{ agency_client_id: CLIENT_ID }], rowCount: 1 };
    });
    const svc = new AmDocumentsService(db as never, staffAuth as never);
    await expect(
      svc.create(
        viewReq,
        { agency_client_id: CLIENT_ID, title: 'Kickoff', href: 'https://docs.ptt.example/kickoff' },
        7,
      ),
    ).rejects.toMatchObject({ status: 503, error: 'documents_table_missing' });
  });
});
