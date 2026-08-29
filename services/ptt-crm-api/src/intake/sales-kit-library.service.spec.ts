import { SalesKitLibraryService } from './sales-kit-library.service';

function readyRow(overrides: Record<string, unknown>) {
  return {
    file_id: '1',
    file_name: 'qa.xlsx',
    folder_path: 'dich-vu-seo-tong-the/qa',
    title: 'đắt',
    body: 'Q: đắt\nA: Neo',
    kind: 'qa' as const,
    is_session: false,
    parse_status: 'ready',
    lead_id: null,
    session_id: null,
    ...overrides,
  };
}

describe('SalesKitLibraryService', () => {
  const repo = {
    listReadyChunks: jest.fn(),
    countFilesByFolder: jest.fn(),
    countFilesBySession: jest.fn(),
    insertFile: jest.fn(),
    updateFileStorage: jest.fn(),
    updateFileParse: jest.fn(),
    listFiles: jest.fn(),
    findFileById: jest.fn(),
    ensurePlaybook: jest.fn(),
    insertChunks: jest.fn(),
    approveFile: jest.fn(),
  };

  const visibility = { assertLeadVisible: jest.fn().mockResolvedValue(undefined) };
  const rateLimit = { check: jest.fn() };
  const aiConfig = { summarizeRateLimitPerMin: 20 };
  const intakePg = { getSession: jest.fn() };
  const fsApi = {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    renameSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
    createReadStream: jest.fn(),
  };

  const session = { id: 12, lead_id: 5, service_slug: 'dich-vu-seo-tong-the' };

  function svc() {
    return new SalesKitLibraryService(
      repo as never,
      visibility as never,
      intakePg as never,
      rateLimit as never,
      aiConfig as never,
      fsApi as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    visibility.assertLeadVisible.mockResolvedValue(undefined);
    rateLimit.check.mockReset();
  });

  it('does not return other-lead session chunks', async () => {
    repo.listReadyChunks.mockResolvedValue([
      readyRow({
        file_id: '9',
        file_name: 'leak.xlsx',
        lead_id: 9,
        session_id: 99,
        folder_path: 'session/9/99',
        body: 'A: leak',
        is_session: true,
        kind: 'session_upload',
      }),
      readyRow({
        lead_id: null,
        folder_path: 'dich-vu-seo-tong-the/qa',
        body: 'Q: đắt\nA: Neo',
        parse_status: 'ready',
      }),
    ]);
    const hits = await svc().retrieveForSession(session, 'đắt', 'ask_library');
    expect(hits.every((h) => h.file_name !== 'leak.xlsx')).toBe(true);
    expect(hits.some((h) => h.body.includes('Neo'))).toBe(true);
  });

  it('includes org slug, _common, and own session folder', async () => {
    repo.listReadyChunks.mockResolvedValue([
      readyRow({ file_id: '1', file_name: 'org.xlsx', folder_path: 'dich-vu-seo-tong-the/qa' }),
      readyRow({
        file_id: '2',
        file_name: 'common.xlsx',
        folder_path: '_common/qa',
        body: 'Q: đắt\nA: Chung',
      }),
      readyRow({
        file_id: '3',
        file_name: 'mine.xlsx',
        lead_id: 5,
        session_id: 12,
        folder_path: 'session/5/12',
        is_session: true,
        kind: 'session_upload',
        body: 'Q: đắt\nA: Túi phiên',
      }),
      readyRow({
        file_id: '4',
        file_name: 'other-slug.xlsx',
        folder_path: 'quang-cao-google/qa',
        body: 'Q: đắt\nA: Ads',
      }),
    ]);
    const hits = await svc().retrieveForSession(session, 'đắt', 'ask_library');
    const names = hits.map((h) => h.file_name);
    expect(names).toEqual(expect.arrayContaining(['org.xlsx', 'common.xlsx', 'mine.xlsx']));
    expect(names).not.toContain('other-slug.xlsx');
  });

  it('rejects docx and unknown MIME as unsupported_type', async () => {
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'note.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        folderKey: 'dich-vu-seo-tong-the/qa',
        actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'unsupported_type' } });
    expect(repo.insertFile).not.toHaveBeenCalled();
  });
});
