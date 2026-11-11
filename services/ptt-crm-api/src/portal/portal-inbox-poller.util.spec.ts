import {
  InboxPollOverlapLock,
  portalInboxPollIntervalMs,
  portalMetaWebhookVerifyToken,
  verifyMetaHubSubscribe,
} from './portal-inbox-poller.util';

describe('portal-inbox-poller.util', () => {
  const prevPollMs = process.env.PTT_PORTAL_INBOX_POLL_MS;
  const prevVerify = process.env.PTT_META_WEBHOOK_VERIFY_TOKEN;

  afterEach(() => {
    if (prevPollMs == null) delete process.env.PTT_PORTAL_INBOX_POLL_MS;
    else process.env.PTT_PORTAL_INBOX_POLL_MS = prevPollMs;
    if (prevVerify == null) delete process.env.PTT_META_WEBHOOK_VERIFY_TOKEN;
    else process.env.PTT_META_WEBHOOK_VERIFY_TOKEN = prevVerify;
  });

  it('clamps poll interval 15s–120s', () => {
    process.env.PTT_PORTAL_INBOX_POLL_MS = '5000';
    expect(portalInboxPollIntervalMs()).toBe(15_000);
    process.env.PTT_PORTAL_INBOX_POLL_MS = '999999';
    expect(portalInboxPollIntervalMs()).toBe(120_000);
    process.env.PTT_PORTAL_INBOX_POLL_MS = '45000';
    expect(portalInboxPollIntervalMs()).toBe(45_000);
  });

  it('overlap lock skips second acquire until release', () => {
    const lock = new InboxPollOverlapLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
    lock.release();
  });

  it('hub verify accepts matching token', () => {
    process.env.PTT_META_WEBHOOK_VERIFY_TOKEN = 'portal-tok';
    expect(portalMetaWebhookVerifyToken()).toBe('portal-tok');
    const out = verifyMetaHubSubscribe(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'portal-tok', 'hub.challenge': '42' },
      'portal-tok',
    );
    expect(out.ok).toBe(true);
    expect(out.challenge).toBe('42');
  });

  it('hub verify rejects wrong token', () => {
    const out = verifyMetaHubSubscribe(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '1' },
      'expected',
    );
    expect(out.ok).toBe(false);
  });
});
