import { ForbiddenException } from '@nestjs/common';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import type { CsdActor } from './csd.types';

describe('CsdChatAccountsService', () => {
  const actor: CsdActor = {
    staffId: 3,
    staffLabel: 'am',
    caps: [{ section: 'csd', action: 'write' }],
  };
  const admin: CsdActor = {
    staffId: 1,
    staffLabel: 'adm',
    caps: [{ section: 'csd', action: 'admin' }],
  };

  const repo = {
    findByStaffId: jest.fn(),
    upsert: jest.fn(),
    listAdmin: jest.fn(),
    searchPeople: jest.fn(),
  };

  const audit = {
    insert: jest.fn(),
  };

  function svc() {
    return new CsdChatAccountsService(repo as never, audit as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    audit.insert.mockResolvedValue(undefined);
  });

  it('getMe disabled when no row', async () => {
    repo.findByStaffId.mockResolvedValue(null);
    await expect(svc().getMe(actor)).resolves.toEqual({
      staff_id: 3,
      enabled: false,
      display_name_vi: null,
    });
  });

  it('admin upsert writes created_by', async () => {
    repo.upsert.mockResolvedValue({ staff_id: 8, enabled: true, created_by_staff_id: 1 });
    await svc().upsert(admin, { staff_id: 8, enabled: true });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by_staff_id: 1, enabled: true }),
    );
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat_account.enable' }));
  });

  it('non-admin cannot upsert', async () => {
    await expect(svc().upsert(actor, { staff_id: 8, enabled: true })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('assertEnabled throws chat_disabled when missing', async () => {
    repo.findByStaffId.mockResolvedValue(null);
    await expect(svc().assertEnabled(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc().assertEnabled(actor)).rejects.toMatchObject({
      response: { error: 'chat_disabled' },
    });
  });
});
