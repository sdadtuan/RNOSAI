import {
  InboxPollOverlapLock,
  KeyedSingleFlight,
  portalInboxPollEnabled,
  portalInboxPollIntervalMs,
  portalInsightsOnDemandTtlMs,
  portalMetaInsightsPollEnabled,
  portalMetaWebhookVerifyToken,
  portalOnDemandTtlMs,
  shouldReuseFreshSync,
  verifyMetaHubSubscribe,
} from './portal-inbox-poller.util';

describe('portal-inbox-poller.util', () => {
  const prev: Record<string, string | undefined> = {};
  const keys = [
    'PTT_PORTAL_INBOX_POLL_MS',
    'PTT_META_WEBHOOK_VERIFY_TOKEN',
    'PTT_PROCESS_ROLE',
    'PTT_PORTAL_WORKER_INBOX_POLL',
    'PTT_PORTAL_INBOX_POLL',
    'PTT_PORTAL_WORKER_META_INSIGHTS_POLL',
    'PTT_PORTAL_ON_DEMAND_TTL_MS',
    'PTT_PORTAL_INSIGHTS_ON_DEMAND_TTL_MS',
  ];

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('disables continuous polling by default for API and worker', () => {
    delete process.env.PTT_PROCESS_ROLE;
    delete process.env.PTT_PORTAL_INBOX_POLL;
    delete process.env.PTT_PORTAL_WORKER_INBOX_POLL;
    delete process.env.PTT_PORTAL_WORKER_META_INSIGHTS_POLL;
    expect(portalInboxPollEnabled()).toBe(false);
    expect(portalMetaInsightsPollEnabled()).toBe(false);

    process.env.PTT_PROCESS_ROLE = 'portal-worker';
    expect(portalInboxPollEnabled()).toBe(false);
    expect(portalMetaInsightsPollEnabled()).toBe(false);

    process.env.PTT_PORTAL_WORKER_INBOX_POLL = '1';
    expect(portalInboxPollEnabled()).toBe(true);
  });

  it('clamps leftover poll interval to 2 min – 1 hour', () => {
    process.env.PTT_PORTAL_INBOX_POLL_MS = '5000';
    expect(portalInboxPollIntervalMs()).toBe(120_000);
    process.env.PTT_PORTAL_INBOX_POLL_MS = '9999999';
    expect(portalInboxPollIntervalMs()).toBe(3_600_000);
    process.env.PTT_PORTAL_INBOX_POLL_MS = '300000';
    expect(portalInboxPollIntervalMs()).toBe(300_000);
  });

  it('clamps on-demand TTL to 10-30 minutes and insights TTL to 15 min - 6 h', () => {
    process.env.PTT_PORTAL_ON_DEMAND_TTL_MS = '1000';
    expect(portalOnDemandTtlMs()).toBe(600_000);
    process.env.PTT_PORTAL_ON_DEMAND_TTL_MS = '900000';
    expect(portalOnDemandTtlMs()).toBe(900_000);
    process.env.PTT_PORTAL_INSIGHTS_ON_DEMAND_TTL_MS = '1000';
    expect(portalInsightsOnDemandTtlMs()).toBe(15 * 60_000);
  });

  it('reuses a fresh sync inside the TTL window', () => {
    expect(shouldReuseFreshSync(1_000, 1_000 + 119_000, 120_000)).toBe(true);
    expect(shouldReuseFreshSync(1_000, 1_000 + 120_000, 120_000)).toBe(false);
    expect(shouldReuseFreshSync(undefined, 50_000, 120_000)).toBe(false);
  });

  it('overlap lock skips second acquire until release', () => {
    const lock = new InboxPollOverlapLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
    lock.release();
  });

  it('keyed single-flight shares one in-flight promise', async () => {
    const flight = new KeyedSingleFlight();
    let runs = 0;
    const task = () => {
      runs += 1;
      return Promise.resolve(runs);
    };
    const [first, second] = await Promise.all([flight.run('a', task), flight.run('a', task)]);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(runs).toBe(1);
    await expect(flight.run('a', task)).resolves.toBe(2);
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
