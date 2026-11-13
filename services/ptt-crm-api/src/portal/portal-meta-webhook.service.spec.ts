import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { PortalMetaWebhookService } from './portal-meta-webhook.service';

const PAGE_ID = '1222371747615610';
const CLIENT_ID = '4286e56e-2618-4d4e-bf05-5ea04837fe05';
const SECRET = 'unit-test-app-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

function fakeReq(input: { query?: Record<string, string>; body?: unknown; raw?: string; sig?: string }) {
  const raw = input.raw ?? JSON.stringify(input.body ?? {});
  return {
    query: input.query ?? {},
    body: input.body ?? JSON.parse(raw || '{}'),
    rawBody: Buffer.from(raw),
    headers: { 'x-hub-signature-256': input.sig ?? '' },
  } as never;
}

describe('PortalMetaWebhookService', () => {
  const prev: Record<string, string | undefined> = {};
  const keys = ['PTT_PORTAL_CRM_CARE', 'CRM_FACEBOOK_APP_SECRET', 'FACEBOOK_APP_SECRET', 'PTT_META_WEBHOOK_VERIFY_TOKEN'];
  let pages: { ensure: jest.Mock; findByChannelPage: jest.Mock };
  let repo: Record<string, jest.Mock>;
  let service: PortalMetaWebhookService;

  beforeEach(() => {
    for (const key of keys) prev[key] = process.env[key];
    process.env.PTT_PORTAL_CRM_CARE = '1';
    process.env.FACEBOOK_APP_SECRET = SECRET;
    delete process.env.CRM_FACEBOOK_APP_SECRET;
    process.env.PTT_META_WEBHOOK_VERIFY_TOKEN = 'verify-tok';
    pages = {
      ensure: jest.fn().mockResolvedValue(undefined),
      findByChannelPage: jest.fn().mockResolvedValue({ client_id: CLIENT_ID, active: true }),
    };
    repo = {
      ensure: jest.fn().mockResolvedValue(undefined),
      ensureWebhookJobs: jest.fn().mockResolvedValue(undefined),
      upsertPageMessage: jest.fn().mockResolvedValue(undefined),
      upsertPageComment: jest.fn().mockResolvedValue(undefined),
      enqueueWebhookJob: jest.fn().mockResolvedValue(true),
      syncCases: jest.fn().mockResolvedValue(undefined),
    };
    service = new PortalMetaWebhookService(repo as never, pages as never);
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('returns the hub challenge on GET verify', async () => {
    const out = await service.handleGet(
      fakeReq({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-tok', 'hub.challenge': '42' } }),
    );
    expect(out).toEqual({ status: 200, body: '42', contentType: 'text/plain' });
  });

  it('rejects a bad signature', async () => {
    const raw = '{"object":"page","entry":[]}';
    await expect(
      service.handlePost(fakeReq({ raw, body: JSON.parse(raw), sig: 'sha256=deadbeef' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('persists a signed inbound message and echo, and enqueues leadgen', async () => {
    const body = {
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: 'psid-1', name: 'Tu Huynh' },
              recipient: { id: PAGE_ID },
              timestamp: 1762923709000,
              message: { mid: 'm_in', text: 'test' },
            },
            {
              sender: { id: PAGE_ID },
              recipient: { id: 'psid-1' },
              timestamp: 1762923720000,
              message: { mid: 'm_out', text: 'xin chào', is_echo: true },
            },
          ],
          changes: [
            { field: 'leadgen', value: { leadgen_id: 'lead-1', form_id: 'form-1', page_id: PAGE_ID } },
            {
              field: 'feed',
              value: {
                item: 'comment',
                verb: 'add',
                comment_id: 'c1',
                post_id: 'p1',
                from: { id: 'psid-1', name: 'Tu Huynh' },
                message: 'hi',
                created_time: 1762923740,
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(body);
    const out = await service.handlePost(fakeReq({ raw, body, sig: sign(raw) }));
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ ok: true, messages: 2, comments: 1, lead_jobs: 1 });
    expect(repo.upsertPageMessage).toHaveBeenCalledTimes(2);
    expect(repo.upsertPageComment).toHaveBeenCalledTimes(1);
    expect(repo.enqueueWebhookJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'leadgen', idempotencyKey: `leadgen:${PAGE_ID}:lead-1` }),
    );
    expect(repo.syncCases).toHaveBeenCalledWith(CLIENT_ID);
    expect(pages.findByChannelPage).toHaveBeenCalledWith('facebook', PAGE_ID);
  });
  it('ingestMessagingFromVerifiedPayload persists messages and postbacks but does not enqueue leadgen', async () => {
    const body = {
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: 'psid-9', name: 'Tuan Truong' },
              recipient: { id: PAGE_ID },
              timestamp: 1762996740000,
              message: { mid: 'm_local_webhook_test', text: 'local webhook test 10:34' },
            },
            {
              sender: { id: 'psid-9' },
              recipient: { id: PAGE_ID },
              timestamp: 1762996741000,
              postback: { mid: 'pb_1', title: 'Get Started', payload: 'GET_STARTED' },
            },
          ],
          changes: [{ field: 'leadgen', value: { leadgen_id: 'lead-should-not-queue', form_id: 'f', page_id: PAGE_ID } }],
        },
      ],
    };
    const out = await service.ingestMessagingFromVerifiedPayload(body);
    expect(out.messages).toBe(2);
    expect(out.clients).toBe(1);
    expect(repo.upsertPageMessage).toHaveBeenCalledTimes(2);
    expect(repo.enqueueWebhookJob).not.toHaveBeenCalled();
    expect(repo.upsertPageComment).not.toHaveBeenCalled();
    expect(repo.syncCases).toHaveBeenCalledWith(CLIENT_ID);
    expect(repo.upsertPageMessage.mock.calls[0][2].body).toContain('local webhook test');
    expect(repo.upsertPageMessage.mock.calls[0][2].direction).toBe('in');
  });

  it('ingestMessagingFromVerifiedPayload ignores non-page objects and inactive pages', async () => {
    await expect(service.ingestMessagingFromVerifiedPayload({ object: 'user' })).resolves.toEqual({
      messages: 0,
      clients: 0,
    });
    pages.findByChannelPage.mockResolvedValueOnce({ client_id: CLIENT_ID, active: false });
    const body = {
      object: 'page',
      entry: [
        {
          id: PAGE_ID,
          messaging: [
            {
              sender: { id: 'psid-x' },
              recipient: { id: PAGE_ID },
              timestamp: Date.now(),
              message: { mid: 'm_x', text: 'no' },
            },
          ],
        },
      ],
    };
    const out = await service.ingestMessagingFromVerifiedPayload(body);
    expect(out.messages).toBe(0);
    expect(repo.upsertPageMessage).not.toHaveBeenCalled();
  });
});

