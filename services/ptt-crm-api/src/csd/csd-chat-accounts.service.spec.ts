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
    findCrmStaff: jest.fn(),
    upsert: jest.fn(),
    listAdmin: jest.fn(),
    listDirectory: jest.fn(),
    searchPeople: jest.fn(),
    findByUsername: jest.fn(),
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
      username: null,
      has_password: false,
    });
  });

  it('admin upsert writes created_by', async () => {
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 8,
      staff_name: 'Lan',
      staff_email: 'lan@ptt.vn',
      position_id: 2,
    });
    repo.upsert.mockResolvedValue({ staff_id: 8, enabled: true, created_by_staff_id: 1 });
    await svc().upsert(admin, { staff_id: 8, enabled: true });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by_staff_id: 1, enabled: true }),
    );
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat_account.enable' }));
  });

  it('upsert rejects staff not in crm_staff', async () => {
    repo.findCrmStaff.mockResolvedValue(null);
    await expect(svc().upsert(admin, { staff_id: 99, enabled: true })).rejects.toMatchObject({
      status: 404,
      response: { error: 'staff_not_found' },
    });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsert stores chat username and password, not staff /login', async () => {
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 8,
      staff_name: 'Lan',
      staff_email: 'lan@ptt.vn',
      position_id: 2,
    });
    repo.findByUsername.mockResolvedValue(null);
    repo.upsert.mockResolvedValue({ staff_id: 8, enabled: true, created_by_staff_id: 1, username: 'lan.chat' });
    await svc().upsert(admin, {
      staff_id: 8,
      enabled: true,
      username: 'lan.chat',
      chat_password: 'Secret12',
    });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_id: 8,
        username: 'lan.chat',
        chat_password: 'Secret12',
      }),
    );
    expect(repo.upsert.mock.calls[0][0].login_password).toBeUndefined();
  });

  it('upsert rejects short chat password', async () => {
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 8,
      staff_name: 'Lan',
      staff_email: 'lan@ptt.vn',
      position_id: 2,
    });
    await expect(
      svc().upsert(admin, { staff_id: 8, enabled: true, username: 'lan.chat', chat_password: '123' }),
    ).rejects.toMatchObject({ status: 400, response: { error: 'password_too_short' } });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('login accepts chat username and password for current staff', async () => {
    repo.findByStaffId.mockResolvedValue({
      staff_id: 3,
      enabled: true,
      username: 'am.chat',
      password_hash: 'plain:ChatPass1',
    });
    await expect(svc().login(actor, { username: 'am.chat', password: 'ChatPass1' })).resolves.toEqual({
      ok: true,
      staff_id: 3,
      username: 'am.chat',
    });
  });

  it('login rejects wrong chat password', async () => {
    repo.findByStaffId.mockResolvedValue({
      staff_id: 3,
      enabled: true,
      username: 'am.chat',
      password_hash: 'plain:ChatPass1',
    });
    await expect(svc().login(actor, { username: 'am.chat', password: 'nope' })).rejects.toMatchObject({
      status: 401,
      response: { error: 'invalid_chat_credentials' },
    });
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
