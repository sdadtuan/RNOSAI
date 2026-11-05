import { CsdChatSessionService } from './csd-chat-session.service';
import { verifyStaffJwt } from '../staff-auth/staff-jwt.util';

jest.mock('../portal/portal-password.util', () => ({
  verifyPortalPassword: jest.fn(),
}));

import { verifyPortalPassword } from '../portal/portal-password.util';

describe('CsdChatSessionService', () => {
  const repo = {
    findByUsername: jest.fn(),
    findCrmStaff: jest.fn(),
  };
  const config = {
    staffJwtSecret: 'secret',
    staffJwtTtlSec: 3600,
  };

  function svc() {
    return new CsdChatSessionService(repo as never, config as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a disabled account with the same error as a bad password', async () => {
    repo.findByUsername.mockResolvedValue({
      enabled: false,
      username: 'lan',
      password_hash: 'hash',
      staff_id: 7,
    });
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 7,
      staff_name: 'Lan',
      staff_email: 'lan@pttads.vn',
      position_id: 3,
    });
    (verifyPortalPassword as jest.Mock).mockReturnValue(true);
    await expect(svc().openSession({ username: 'lan', password: 'secret' })).rejects.toMatchObject({
      response: { error: 'invalid_chat_credentials' },
    });
  });

  it('signs a chat-scoped access token and does not return a refresh token', async () => {
    repo.findByUsername.mockResolvedValue({
      enabled: true,
      username: 'lan',
      password_hash: 'hash',
      staff_id: 7,
      display_name_vi: 'Lan',
    });
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 7,
      staff_name: 'Lan',
      staff_email: 'lan@pttads.vn',
      position_id: 3,
    });
    (verifyPortalPassword as jest.Mock).mockReturnValue(true);
    const out = await svc().openSession({ username: 'Lan', password: 'secret' });
    expect(out.refresh_token).toBeUndefined();
    expect(out.staff_id).toBe(7);
    expect(repo.findByUsername).toHaveBeenCalledWith('lan');
    const payload = verifyStaffJwt(out.access_token, 'secret');
    expect(payload?.scope).toBe('chat');
    expect(payload?.sub).toBe('7');
    expect(payload?.token_type).toBe('access');
  });

  it('uses the same error when the password is wrong', async () => {
    repo.findByUsername.mockResolvedValue({
      enabled: true,
      username: 'lan',
      password_hash: 'hash',
      staff_id: 7,
    });
    repo.findCrmStaff.mockResolvedValue({
      staff_id: 7,
      staff_name: 'Lan',
      staff_email: 'lan@pttads.vn',
      position_id: 3,
    });
    (verifyPortalPassword as jest.Mock).mockReturnValue(false);
    await expect(svc().openSession({ username: 'lan', password: 'nope' })).rejects.toMatchObject({
      response: { error: 'invalid_chat_credentials' },
    });
  });
});
