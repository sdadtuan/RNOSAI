import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CsdEmailService } from './csd-email.service';
import type { CsdActor } from './csd.types';

describe('CsdEmailService', () => {
  const actor: CsdActor = {
    staffId: 5,
    staffLabel: 'pm@test.vn',
    caps: [{ section: 'csd', action: 'write' }],
  };

  const repo = {
    insertOutbound: jest.fn(),
    insertAttachment: jest.fn(),
    insertApproval: jest.fn(),
    markSent: jest.fn(),
  };
  const tickets = {};
  const config = { emailSendEnabled: false };
  let tmp: string;
  let prevFileDir: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    prevFileDir = process.env.PTT_CSD_FILE_DIR;
    tmp = mkdtempSync(join(tmpdir(), 'csd-email-'));
    process.env.PTT_CSD_FILE_DIR = tmp;
  });

  afterEach(() => {
    if (prevFileDir === undefined) delete process.env.PTT_CSD_FILE_DIR;
    else process.env.PTT_CSD_FILE_DIR = prevFileDir;
    rmSync(tmp, { recursive: true, force: true });
  });

  function svc() {
    return new CsdEmailService(repo as never, tickets as never, config as never);
  }

  it('persists attachments as client email files after insertOutbound', async () => {
    repo.insertOutbound.mockResolvedValue({ id: 'e1', send_status: 'queued' });
    repo.insertAttachment.mockResolvedValue({ id: 'a1', visibility: 'client' });

    await svc().send(actor, {
      to: ['client@test.vn'],
      subject: 'BC tuan',
      body_text: 'Noi dung',
      attachments: [
        {
          filename: 'PTT-weekly_ops-v1.0.pdf',
          content_type: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4'),
        },
      ],
    });

    expect(repo.insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'email',
        entity_id: 'e1',
        visibility: 'client',
        file_name: 'PTT-weekly_ops-v1.0.pdf',
        mime_type: 'application/pdf',
      }),
    );
    expect(repo.markSent).not.toHaveBeenCalled();
  });

  it('does not insert attachment when none passed', async () => {
    repo.insertOutbound.mockResolvedValue({ id: 'e1', send_status: 'queued' });

    await svc().send(actor, {
      to: ['client@test.vn'],
      subject: 'BC tuan',
      body_text: 'Noi dung',
    });

    expect(repo.insertAttachment).not.toHaveBeenCalled();
  });
});
