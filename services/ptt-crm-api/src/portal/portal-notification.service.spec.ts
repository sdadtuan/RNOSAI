import { AppConfigService } from '../config/app-config.service';
import { PortalNotificationRepository } from './portal-notification.repository';
import { PortalNotificationService } from './portal-notification.service';
import { PortalNotifyWebhookService } from './portal-notify-webhook.service';
import { PortalPushSenderService } from './portal-push-sender.service';

describe('PortalNotificationService', () => {
  const config = {
    portalClientNotifyEnabled: true,
  } as AppConfigService;

  const repo = {
    tableReady: jest.fn().mockResolvedValue(true),
    listForUser: jest.fn().mockResolvedValue({ rows: [], unread: 0 }),
    listActivePortalUsers: jest.fn().mockResolvedValue([
      { id: 'user-1', email: 'approver@test.local', role: 'approver' },
    ]),
    insert: jest.fn().mockResolvedValue({
      id: 'notif-1',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      portal_user_id: 'user-1',
      category: 'creative_pending',
      title: 'Test',
      body: 'Body',
      link_url: '/creatives',
      meta: {},
      read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    }),
    countPendingCreatives: jest.fn().mockResolvedValue(2),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    emptySummary: jest.fn(),
  } as unknown as jest.Mocked<PortalNotificationRepository>;

  const webhook = {
    send: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as jest.Mocked<PortalNotifyWebhookService>;

  const pushSender = {
    sendToUsers: jest.fn().mockResolvedValue({
      ok: true,
      configured: true,
      sent: 1,
      failed: 0,
      removed_stale: 0,
      errors: [],
    }),
  } as unknown as jest.Mocked<PortalPushSenderService>;

  function makeService() {
    return new PortalNotificationService(repo, webhook, config, pushSender);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    repo.tableReady.mockResolvedValue(true);
    repo.listForUser.mockResolvedValue({ rows: [], unread: 0 });
    repo.listActivePortalUsers.mockResolvedValue([
      { id: 'user-1', email: 'approver@test.local', role: 'approver' },
    ]);
    repo.insert.mockResolvedValue({
      id: 'notif-1',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      portal_user_id: 'user-1',
      category: 'creative_pending',
      title: 'Test',
      body: 'Body',
      link_url: '/creatives',
      meta: {},
      read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    repo.countPendingCreatives.mockResolvedValue(2);
    webhook.send.mockResolvedValue({ ok: true });
    pushSender.sendToUsers.mockResolvedValue({
      ok: true,
      configured: true,
      sent: 1,
      failed: 0,
      removed_stale: 0,
      errors: [],
    });
  });

  it('emitCreativePending inserts for approvers', async () => {
    const svc = makeService();
    const result = await svc.emitCreativePending({
      id: 'cr-1',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Banner A',
      description: null,
      external_campaign_id: null,
      external_campaign_name: null,
      version: 1,
      asset_url: null,
      asset_type: 'image',
      status: 'pending_client',
      submitted_by: 'am@test.local',
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      temporal_workflow_id: null,
      channel: 'meta',
    });
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['notif-1']);
    expect(repo.insert).toHaveBeenCalled();
    expect(webhook.send).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'portal_client_notification', category: 'creative_pending' }),
    );
    expect(pushSender.sendToUsers).toHaveBeenCalled();
  });

  it('list returns empty when table not ready', async () => {
    repo.tableReady.mockResolvedValueOnce(false);
    const svc = makeService();
    const out = await svc.list({
      sub: 'user-1',
      email: 'a@test.local',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'approver',
      iat: 0,
      exp: 9999999999,
    });
    expect(out.table_ready).toBe(false);
    expect(out.rows).toEqual([]);
  });


  it('emitToUser inserts for one user and sends a web push', async () => {
    repo.tableReady.mockResolvedValue(true);
    repo.insert.mockResolvedValue({
      id: 'notif-care',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      portal_user_id: 'staff-1',
      category: 'care_assigned',
      title: 'Bạn được phân công: Lan',
      body: 'Tin nhắn “Lan” đã được gán cho bạn.',
      link_url: '/crm/messages?case=c1',
      meta: { case_id: 'c1' },
      read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    const svc = makeService();
    const result = await svc.emitToUser({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      portalUserId: 'staff-1',
      category: 'care_assigned',
      title: 'Bạn được phân công: Lan',
      body: 'Tin nhắn “Lan” đã được gán cho bạn.',
      linkUrl: '/crm/messages?case=c1',
      meta: { case_id: 'c1' },
    });
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['notif-care']);
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 'staff-1', category: 'care_assigned' }),
    );
    expect(repo.listActivePortalUsers).not.toHaveBeenCalled();
    expect(pushSender.sendToUsers).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserIds: ['staff-1'] }),
    );
  });

  it('emitToUser is a no-op when portalUserId is empty', async () => {
    const svc = makeService();
    const result = await svc.emitToUser({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      portalUserId: '  ',
      category: 'care_assigned',
      title: 'x',
    });
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual([]);
  });

  it('list passes the caller role so staff do not receive other users’ rows', async () => {
    repo.tableReady.mockResolvedValue(true);
    repo.listForUser.mockResolvedValue({ rows: [], unread: 0 });
    const svc = makeService();
    await svc.list({
      sub: 'staff-1',
      email: 's@test.local',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'staff',
      iat: 0,
      exp: 9999999999,
    });
    expect(repo.listForUser).toHaveBeenCalledWith(
      expect.objectContaining({ portalUserId: 'staff-1', role: 'staff' }),
    );
  });
});
