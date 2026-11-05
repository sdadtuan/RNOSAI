import { CsdChatFriendsService } from './csd-chat-friends.service';
import type { CsdActor } from './csd.types';

describe('CsdChatFriendsService', () => {
  const actor: CsdActor = {
    staffId: 3,
    staffLabel: 'am',
    caps: [{ section: 'csd', action: 'write' }],
  };

  const accounts = {
    assertEnabled: jest.fn(),
    isEnabled: jest.fn(),
    searchPeople: jest.fn(),
  };

  const repo = {
    findPair: jest.fn(),
    findById: jest.fn(),
    insertPending: jest.fn(),
    setStatus: jest.fn(),
    deleteById: jest.fn(),
    listAcceptedPeople: jest.fn(),
    listPendingIncoming: jest.fn(),
    listPendingOutgoing: jest.fn(),
    listPeerStaffIds: jest.fn(),
    setBlocked: jest.fn(),
  };

  const notifications = {
    insert: jest.fn(),
  };

  function svc() {
    return new CsdChatFriendsService(repo as never, accounts as never, notifications as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.assertEnabled.mockResolvedValue(undefined);
    accounts.isEnabled.mockResolvedValue(true);
    notifications.insert.mockResolvedValue(undefined);
  });

  it('request then accept then isAccepted', async () => {
    accounts.isEnabled.mockImplementation(async (id: number) => id === 3 || id === 8);
    repo.findPair
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'f1', status: 'pending', requester_staff_id: 3, addressee_staff_id: 8 });
    repo.insertPending.mockResolvedValue({
      id: 'f1',
      status: 'pending',
      requester_staff_id: 3,
      addressee_staff_id: 8,
    });
    await svc().request(actor, 8);
    repo.findById.mockResolvedValue({
      id: 'f1',
      status: 'pending',
      requester_staff_id: 3,
      addressee_staff_id: 8,
    });
    repo.setStatus.mockResolvedValue({ id: 'f1', status: 'accepted' });
    await svc().accept({ staffId: 8, staffLabel: 'b', caps: actor.caps }, 'f1');
    repo.findPair.mockResolvedValue({ status: 'accepted' });
    await expect(svc().isAccepted(3, 8)).resolves.toBe(true);
  });

  it('rejects self friend', async () => {
    await expect(svc().request(actor, 3)).rejects.toMatchObject({
      status: 400,
      response: { error: 'cannot_friend_self' },
    });
  });
});
