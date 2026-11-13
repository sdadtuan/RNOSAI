import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import * as metaParser from './meta-webhook.parser';
import * as metaContext from './meta-webhook-context';
import * as metaPageToken from './meta-page-token';

describe('WebhooksService handleMeta portal inbox forward', () => {
  const portalMetaWebhooks = {
    ingestMessagingFromVerifiedPayload: jest.fn().mockResolvedValue({ messages: 1, clients: 1 }),
  };
  const nestIngest = {
    ingestPreparedLeads: jest.fn().mockResolvedValue({
      mode: 'nest',
      created: 1,
      duplicates: 0,
      failed: 0,
      lead_ids: [1],
    }),
  };
  const metaWebhookRepo = {
    resolveClientId: jest.fn().mockResolvedValue('client-1'),
    resolvePageAccessToken: jest.fn().mockResolvedValue('page-token'),
    normalizeClientUuid: jest.fn().mockReturnValue('client-1'),
  };
  const metaOpsWebhookService = { processPayload: jest.fn().mockResolvedValue({ handled: 0 }) };
  const b2bIngest = {
    prepareWebhookLeads: jest.fn(async ({ leads }: { leads: unknown[] }) => ({
      toEnqueue: leads,
      unmatchedCount: 0,
    })),
  };
  const jobQueue = {};
  const b2bConversations = {};
  const config = { webhooksNestMetaEnabled: true };

  let parseMeta: jest.SpyInstance;
  let parseJson: jest.SpyInstance;
  let extract: jest.SpyInstance;
  let exchange: jest.SpyInstance;
  let service: WebhooksService;

  function req(body: Record<string, unknown>, method = 'POST') {
    const raw = Buffer.from(JSON.stringify(body));
    return {
      method,
      headers: { 'x-hub-signature-256': 'sha256=abc', 'x-correlation-id': 'c-1' },
      rawBody: raw,
      body,
      query: {},
    } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    portalMetaWebhooks.ingestMessagingFromVerifiedPayload.mockResolvedValue({ messages: 1, clients: 1 });
    parseMeta = jest.spyOn(metaParser, 'parseMetaWebhook');
    parseJson = jest.spyOn(metaParser, 'parseFacebookWebhookJson');
    extract = jest.spyOn(metaContext, 'extractMetaLeadgenContext').mockReturnValue({
      pageIds: ['1222371747615610'],
      formIds: [],
    } as never);
    exchange = jest.spyOn(metaPageToken, 'exchangeForPageAccessToken').mockResolvedValue('page-token');
    service = new WebhooksService(
      config as never,
      jobQueue as never,
      metaWebhookRepo as never,
      metaOpsWebhookService as never,
      b2bIngest as never,
      b2bConversations as never,
      nestIngest as never,
      portalMetaWebhooks as never,
    );
  });

  afterEach(() => {
    parseMeta?.mockRestore();
    parseJson?.mockRestore();
    extract?.mockRestore();
    exchange?.mockRestore();
  });

  it('forwards a verified messaging payload to portal ingest and skips lead enqueue when there are no leads', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: '1222371747615610',
          messaging: [
            {
              sender: { id: 'psid-1', name: 'Tuan Truong' },
              recipient: { id: '1222371747615610' },
              timestamp: 1762996740000,
              message: { mid: 'm_1', text: 'hello' },
            },
          ],
        },
      ],
    };
    parseJson.mockReturnValue(payload);
    parseMeta.mockResolvedValue({
      verified: true,
      leads: [],
      events: ['messages'],
      page_ids: ['1222371747615610'],
      form_ids: [],
    });

    const out = await service.handle('meta', req(payload));
    expect(out.status).toBe(200);
    expect(out.body).toEqual(
      expect.objectContaining({
        verified: true,
        lead_count: 0,
        portal_inbox: { messages: 1, clients: 1 },
      }),
    );
    expect(portalMetaWebhooks.ingestMessagingFromVerifiedPayload).toHaveBeenCalledTimes(1);
    expect(portalMetaWebhooks.ingestMessagingFromVerifiedPayload).toHaveBeenCalledWith(payload);
    expect(nestIngest.ingestPreparedLeads).not.toHaveBeenCalled();
    expect(b2bIngest.prepareWebhookLeads).not.toHaveBeenCalled();
  });

  it('does not call portal ingest when the signature is rejected', async () => {
    parseJson.mockReturnValue({ object: 'page', entry: [] });
    parseMeta.mockResolvedValue({
      verified: false,
      reject_reason: 'bad signature',
      leads: [],
      events: [],
    });
    await expect(service.handle('meta', req({ object: 'page' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(portalMetaWebhooks.ingestMessagingFromVerifiedPayload).not.toHaveBeenCalled();
  });

  it('keeps leadgen handling and still forwards messaging from the same payload', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: '1222371747615610',
          messaging: [
            {
              sender: { id: 'psid-1' },
              recipient: { id: '1222371747615610' },
              timestamp: 1,
              message: { mid: 'm_1', text: 'hi' },
            },
          ],
          changes: [{ field: 'leadgen', value: { leadgen_id: 'L1', page_id: '1222371747615610', form_id: 'F1' } }],
        },
      ],
    };
    const lead = {
      client_id: 'client-1',
      channel: 'meta',
      external_lead_id: 'L1',
      idempotency_key: 'k',
      occurred_at: '2026-11-13T00:00:00Z',
      contact: { full_name: '', phone: '', email: null },
      fields: {},
      raw: {},
    };
    parseJson.mockReturnValue(payload);
    parseMeta.mockResolvedValue({
      verified: true,
      leads: [lead],
      events: ['leadgen', 'messages'],
      page_ids: ['1222371747615610'],
      form_ids: ['F1'],
    });

    const out = await service.handle('meta', req(payload));
    expect(out.status).toBe(200);
    expect(b2bIngest.prepareWebhookLeads).toHaveBeenCalledTimes(1);
    expect(nestIngest.ingestPreparedLeads).toHaveBeenCalledTimes(1);
    expect(nestIngest.ingestPreparedLeads.mock.calls[0][0]).toEqual([lead]);
    expect(portalMetaWebhooks.ingestMessagingFromVerifiedPayload).toHaveBeenCalledWith(payload);
    expect((out.body as Record<string, unknown>).portal_inbox).toEqual({ messages: 1, clients: 1 });
    expect((out.body as Record<string, unknown>).created_count).toBe(1);
    expect((out.body as Record<string, unknown>).verified).toBe(true);
  });

  it('still returns 200 for leadgen if portal ingest throws', async () => {
    portalMetaWebhooks.ingestMessagingFromVerifiedPayload.mockRejectedValueOnce(new Error('db down'));
    const lead = {
      client_id: 'client-1',
      channel: 'meta',
      external_lead_id: 'L1',
      idempotency_key: 'k',
      occurred_at: '2026-11-13T00:00:00Z',
      contact: { full_name: '', phone: '', email: null },
      fields: {},
      raw: {},
    };
    parseJson.mockReturnValue({ object: 'page', entry: [] });
    parseMeta.mockResolvedValue({
      verified: true,
      leads: [lead],
      events: ['leadgen'],
      page_ids: [],
      form_ids: [],
    });
    const out = await service.handle('meta', req({ object: 'page', entry: [] }));
    expect(out.status).toBe(200);
    expect(nestIngest.ingestPreparedLeads).toHaveBeenCalled();
    expect((out.body as Record<string, unknown>).portal_inbox).toEqual({
      messages: 0,
      clients: 0,
      error: 'ingest_failed',
    });
  });
});
