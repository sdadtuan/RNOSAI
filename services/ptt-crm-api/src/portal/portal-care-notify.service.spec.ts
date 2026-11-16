import { PortalCareNotifyService } from './portal-care-notify.service';

describe('PortalCareNotifyService', () => {
  function make(overrides: {
    notifications?: Record<string, jest.Mock>;
    repo?: Record<string, jest.Mock>;
    notificationRepo?: Record<string, jest.Mock>;
  } = {}) {
    const notifications = {
      emitToUser: jest.fn().mockResolvedValue({ ok: true, ids: ['n1'] }),
      ...(overrides.notifications ?? {}),
    };
    const repo = {
      findCase: jest.fn().mockResolvedValue({ id: 'c1', title: 'Lan', kind: 'message' }),
      casesForSenders: jest.fn().mockResolvedValue([
        { id: 'c1', title: 'Lan', kind: 'message', assignee_user_id: 's1', page_id: 'p1' },
      ]),
      ...(overrides.repo ?? {}),
    };
    const notificationRepo = {
      findUnreadByCase: jest.fn().mockResolvedValue(null),
      ...(overrides.notificationRepo ?? {}),
    };
    const service = new PortalCareNotifyService(
      notifications as never,
      repo as never,
      notificationRepo as never,
    );
    return { service, notifications, repo, notificationRepo };
  }

  it('notifies the new assignee and the previous assignee on a hop', async () => {
    const { service, notifications } = make();
    await service.notifyAssignment({
      clientId: 'client-1',
      caseId: 'c1',
      assigneeId: 's2',
      previousAssigneeId: 's1',
      reason: 'hop',
    });
    const categories = notifications.emitToUser.mock.calls.map((c) => c[0].category);
    expect(categories).toEqual(['care_reassigned', 'care_assigned']);
    expect(notifications.emitToUser).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 's1', category: 'care_reassigned', linkUrl: '/crm/messages?case=c1' }),
    );
    expect(notifications.emitToUser).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 's2', category: 'care_assigned' }),
    );
  });

  it('skips a no-op when the assignee does not change', async () => {
    const { service, notifications } = make();
    await service.notifyAssignment({
      clientId: 'client-1',
      caseId: 'c1',
      assigneeId: 's1',
      previousAssigneeId: 's1',
      reason: 'manual',
    });
    expect(notifications.emitToUser).not.toHaveBeenCalled();
  });

  it('only notifies the previous assignee on unassign', async () => {
    const { service, notifications } = make();
    await service.notifyAssignment({
      clientId: 'client-1',
      caseId: 'c1',
      assigneeId: null,
      previousAssigneeId: 's1',
      reason: 'unassign',
    });
    expect(notifications.emitToUser).toHaveBeenCalledTimes(1);
    expect(notifications.emitToUser).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 's1', category: 'care_reassigned' }),
    );
  });

  it('notifies the assignee of a new inbound message', async () => {
    const { service, notifications } = make();
    await service.notifyInboundMessages('client-1', [
      { page_id: 'p1', sender_name: 'Lan', sender_psid: 'ps1', body: 'Xin chào' },
    ]);
    expect(notifications.emitToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        portalUserId: 's1',
        category: 'care_message',
        title: 'Tin nhắn mới từ Lan',
        body: 'Xin chào',
      }),
    );
  });

  it('dedupes unread care_message notifications for the same case', async () => {
    const { service, notifications, notificationRepo } = make({
      notificationRepo: { findUnreadByCase: jest.fn().mockResolvedValue({ id: 'existing' }) },
    });
    await service.notifyInboundMessages('client-1', [
      { page_id: 'p1', sender_name: 'Lan', sender_psid: 'ps1', body: 'Lần 2' },
    ]);
    expect(notificationRepo.findUnreadByCase).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 's1', category: 'care_message', caseId: 'c1' }),
    );
    expect(notifications.emitToUser).not.toHaveBeenCalled();
  });

  it('skips inbound notify when the case is not yet assigned', async () => {
    const { service, notifications } = make({
      repo: {
        findCase: jest.fn(),
        casesForSenders: jest.fn().mockResolvedValue([
          { id: 'c1', title: 'Lan', kind: 'message', assignee_user_id: null, page_id: 'p1' },
        ]),
      },
    });
    await service.notifyInboundMessages('client-1', [
      { page_id: 'p1', sender_name: 'Lan', body: 'Hi' },
    ]);
    expect(notifications.emitToUser).not.toHaveBeenCalled();
  });

  it('does not throw when emitToUser fails', async () => {
    const { service } = make({
      notifications: { emitToUser: jest.fn().mockRejectedValue(new Error('push down')) },
    });
    await expect(
      service.notifyAssignment({
        clientId: 'client-1',
        caseId: 'c1',
        assigneeId: 's2',
        previousAssigneeId: null,
        reason: 'auto',
      }),
    ).resolves.toBeUndefined();
  });
});
