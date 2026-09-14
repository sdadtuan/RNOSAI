import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CsdChatCallsService } from './csd-chat-calls.service';

describe('CsdChatCallsService', () => {
  const repo = {
    getConversationForMember: jest.fn(),
    listMembers: jest.fn(),
    findStaffDisplayName: jest.fn(),
  };
  const stringee = {
    isConfigured: jest.fn(),
    createStaffUserToken: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repo.getConversationForMember.mockResolvedValue({ id: 'c1', kind: 'direct' });
    repo.listMembers.mockResolvedValue([
      { member_staff_id: 3 },
      { member_staff_id: 8 },
    ]);
    repo.findStaffDisplayName.mockResolvedValue('Nguyễn Văn B');
    stringee.isConfigured.mockReturnValue(true);
    stringee.createStaffUserToken.mockReturnValue({
      access_token: 'tok',
      user_id: 'staff_3',
    });
  });

  it('returns stringee token for direct conversation peer', async () => {
    const svc = new CsdChatCallsService(repo as never, stringee as never);
    const out = await svc.prepareDirectCall({ staffId: 3, staffLabel: 'A', caps: [] }, 'c1', 'video');
    expect(out.provider).toBe('stringee');
    expect(out.mode).toBe('video');
    expect(out.access_token).toBe('tok');
    expect(out.to_user_id).toBe('staff_8');
    expect(out.peer_staff_id).toBe(8);
  });

  it('rejects non-direct conversations', async () => {
    repo.getConversationForMember.mockResolvedValue({ id: 'c1', kind: 'group' });
    const svc = new CsdChatCallsService(repo as never, stringee as never);
    await expect(
      svc.prepareDirectCall({ staffId: 3, staffLabel: 'A', caps: [] }, 'c1', 'voice'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns unavailable when stringee is not configured', async () => {
    stringee.isConfigured.mockReturnValue(false);
    stringee.createStaffUserToken.mockReturnValue(null);
    const svc = new CsdChatCallsService(repo as never, stringee as never);
    const out = await svc.prepareDirectCall({ staffId: 3, staffLabel: 'A', caps: [] }, 'c1', 'voice');
    expect(out.provider).toBe('unavailable');
    expect(out.access_token).toBeUndefined();
  });

  it('404 when conversation missing for actor', async () => {
    repo.getConversationForMember.mockResolvedValue(null);
    const svc = new CsdChatCallsService(repo as never, stringee as never);
    await expect(
      svc.prepareDirectCall({ staffId: 3, staffLabel: 'A', caps: [] }, 'c1', 'voice'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
