import { SalesKitLibraryService } from './sales-kit-library.service';
import type { SalesKitFileRow } from './sales-kit-library.repository';
import { buildSalesKitSampleXlsx } from './sales-kit-sample.util';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function fileRow(overrides: Partial<SalesKitFileRow> = {}): SalesKitFileRow {
  return {
    id: 'f1',
    playbook_id: 'pb1',
    lead_id: null,
    session_id: null,
    folder_key: 'dich-vu-seo-tong-the/qa',
    original_name: 'mau.xlsx',
    mime: XLSX_MIME,
    storage_key: 'k',
    parse_status: 'pending',
    parse_error: null,
    uploaded_by: 1,
    created_at: '2026-01-01',
    ...overrides,
  };
}

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
    tableReady: jest.fn().mockResolvedValue(true),
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

  it('rejects org upload whose folder_key starts with session', async () => {
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'qa.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        folderKey: 'session/5/12',
        actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'invalid_folder_key' } });
    expect(repo.ensurePlaybook).not.toHaveBeenCalled();
    expect(repo.insertFile).not.toHaveBeenCalled();
  });

  it('refuses to approve files that are not pending parse', async () => {
    const actor = { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] };
    for (const parse_status of ['failed', 'needs_ocr', 'pending_vision']) {
      repo.findFileById.mockResolvedValueOnce({
        id: 'f1',
        playbook_id: 'pb1',
        lead_id: null,
        session_id: null,
        folder_key: 'dich-vu-seo-tong-the/qa',
        original_name: 'qa.xlsx',
        mime: 'application/pdf',
        storage_key: 'k',
        parse_status,
        parse_error: null,
        uploaded_by: 1,
        created_at: '2026-01-01',
      } satisfies SalesKitFileRow);
      await expect(svc().approveFile('f1', actor)).rejects.toMatchObject({
        response: { error: 'not_approvable' },
      });
    }
    expect(repo.approveFile).not.toHaveBeenCalled();
  });

  it('approves pending org files with configure and no crm_leads.edit', async () => {
    const pending = {
      id: 'f1',
      playbook_id: 'pb1',
      lead_id: null,
      session_id: null,
      folder_key: 'dich-vu-seo-tong-the/qa',
      original_name: 'qa.xlsx',
      mime: 'application/pdf',
      storage_key: 'k',
      parse_status: 'pending',
      parse_error: null,
      uploaded_by: 1,
      created_at: '2026-01-01',
    } satisfies SalesKitFileRow;
    repo.findFileById.mockResolvedValue(pending);
    repo.approveFile.mockResolvedValue({ ...pending, parse_status: 'ready' });
    const out = await svc().approveFile('f1', {
      staffId: 1,
      caps: [{ section: 'playbooks', action: 'configure' }],
    });
    expect(out.parse_status).toBe('ready');
    expect(repo.approveFile).toHaveBeenCalledWith('f1');
  });

  it('passes visibility filter and kindHint into retrieve', async () => {
    repo.listReadyChunks.mockResolvedValue([
      readyRow({ folder_path: 'dich-vu-seo-tong-the/qa' }),
    ]);
    await svc().retrieveForSession(session, 'đắt', 'ask_library');
    expect(repo.listReadyChunks).toHaveBeenCalledWith({
      serviceSlug: 'dich-vu-seo-tong-the',
      leadId: 5,
      sessionId: 12,
    });
  });

  it('rejects org upload when actor caps are empty (unresolved JWT)', async () => {
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'qa.xlsx',
          mimetype: XLSX_MIME,
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        folderKey: 'dich-vu-seo-tong-the/qa',
        actor: { staffId: 0, caps: [] },
      }),
    ).rejects.toMatchObject({ response: { error: 'missing_cap' } });
    expect(repo.insertFile).not.toHaveBeenCalled();
  });

  it('rejects oversize and missing schema before write', async () => {
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
          size: 8 * 1024 * 1024 + 1,
          buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
        } as Express.Multer.File,
        folderKey: 'dich-vu-seo-tong-the/qa',
        actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'file_too_large' } });

    repo.tableReady.mockResolvedValueOnce(false);
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'qa.xlsx',
          mimetype: XLSX_MIME,
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        folderKey: 'dich-vu-seo-tong-the/qa',
        actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'schema_not_ready' } });
    expect(repo.insertFile).not.toHaveBeenCalled();
  });

  it('enforces folder and session caps', async () => {
    repo.countFilesByFolder.mockResolvedValue(40);
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'qa.xlsx',
          mimetype: XLSX_MIME,
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        folderKey: 'dich-vu-seo-tong-the/qa',
        actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'folder_limit' } });

    repo.countFilesBySession.mockResolvedValue(10);
    intakePg.getSession.mockResolvedValue({ id: 12, lead_id: 5 });
    await expect(
      svc().uploadFile({
        file: {
          originalname: 'qa.xlsx',
          mimetype: XLSX_MIME,
          size: 100,
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        leadId: 5,
        sessionId: 12,
        actor: { staffId: 1, caps: [{ section: 'crm_leads', action: 'edit' }] },
      }),
    ).rejects.toMatchObject({ response: { error: 'session_limit' } });
  });

  it('org xlsx upload inserts chunks and stays pending', async () => {
    const buf = await buildSalesKitSampleXlsx();
    repo.countFilesByFolder.mockResolvedValue(0);
    repo.ensurePlaybook.mockResolvedValue({ id: 'pb1', status: 'draft' });
    repo.insertFile.mockResolvedValue(fileRow());
    repo.findFileById.mockResolvedValue(fileRow({ storage_key: 'dich-vu-seo-tong-the/qa/f1-mau.xlsx' }));
    const out = await svc().uploadFile({
      file: {
        originalname: 'mau.xlsx',
        mimetype: XLSX_MIME,
        size: buf.length,
        buffer: buf,
      } as Express.Multer.File,
      folderKey: 'dich-vu-seo-tong-the/qa',
      actor: { staffId: 1, caps: [{ section: 'playbooks', action: 'configure' }] },
    });
    expect(fsApi.writeFileSync).toHaveBeenCalled();
    expect(fsApi.renameSync).toHaveBeenCalled();
    expect(repo.insertChunks).toHaveBeenCalled();
    expect(repo.updateFileParse).toHaveBeenCalledWith('f1', 'pending', null);
    expect(out.parse_status).toBe('pending');
  });

  it('session bag xlsx is ready without approve', async () => {
    const buf = await buildSalesKitSampleXlsx();
    intakePg.getSession.mockResolvedValue({ id: 12, lead_id: 5 });
    repo.countFilesBySession.mockResolvedValue(0);
    repo.ensurePlaybook.mockResolvedValue({ id: 'pb1', status: 'active' });
    repo.insertFile.mockResolvedValue(
      fileRow({ lead_id: 5, session_id: 12, folder_key: 'session/5/12' }),
    );
    repo.findFileById.mockResolvedValue(
      fileRow({
        lead_id: 5,
        session_id: 12,
        folder_key: 'session/5/12',
        parse_status: 'ready',
      }),
    );
    const out = await svc().uploadFile({
      file: {
        originalname: 'mau.xlsx',
        mimetype: XLSX_MIME,
        size: buf.length,
        buffer: buf,
      } as Express.Multer.File,
      leadId: 5,
      sessionId: 12,
      actor: { staffId: 1, caps: [{ section: 'crm_leads', action: 'edit' }] },
    });
    expect(repo.updateFileParse).toHaveBeenCalledWith('f1', 'ready', null);
    expect(out.parse_status).toBe('ready');
  });
});
