import { CsdChatFilesService } from './csd-chat-files.service';

describe('CsdChatFilesService', () => {
  const actor = { staffId: 3, staffLabel: 'am', caps: [{ section: 'csd', action: 'write' }] };
  const repo = {
    getConversation: jest.fn(),
    getMessage: jest.fn(),
    insertAttachment: jest.fn(),
    getAttachment: jest.fn(),
    attachConversationFilesToMessage: jest.fn(),
    listAttachmentsByMessages: jest.fn(),
    copyAttachmentsToEntity: jest.fn(),
  };
  const io = {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    createReadStream: jest.fn(),
    fileDir: () => '/tmp/csd-files-test',
  };

  function svc() {
    const out = new CsdChatFilesService(repo as never);
    out.io = io;
    return out;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets visibility=client on client conversations', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client' });
    repo.insertAttachment.mockResolvedValue({ id: 'a1', visibility: 'client' });
    const out = await svc().upload(actor, 'c1', {
      originalname: 'shot.png',
      mimetype: 'image/png',
      size: 12,
      buffer: Buffer.from('png'),
    } as Express.Multer.File);
    expect(repo.insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'client', entity_type: 'csd_conversation', entity_id: 'c1' }),
    );
    expect(out.visibility).toBe('client');
  });

  it('rejects files over 100MB', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group' });
    await expect(
      svc().upload(actor, 'c1', {
        originalname: 'big.bin',
        mimetype: 'application/octet-stream',
        size: 104857601,
        buffer: Buffer.alloc(10),
      } as Express.Multer.File),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.insertAttachment).not.toHaveBeenCalled();
  });

  it('forbids internal file to client viewer on client conversation', async () => {
    repo.getAttachment.mockResolvedValue({
      id: 'a1',
      visibility: 'internal',
      entity_type: 'csd_conversation',
      entity_id: 'c1',
      storage_key: 'c1/a1.bin',
    });
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client' });
    await expect(svc().openForDownload(actor, 'a1', { asClient: true })).rejects.toMatchObject({
      status: 403,
    });
  });
});
