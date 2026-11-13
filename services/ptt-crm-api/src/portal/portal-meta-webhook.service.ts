import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PortalClientPagesRepository } from '../agency/portal-client-pages.repository';
import { portalCrmCareEnabled } from '../agency/portal-client-pages.util';
import { metaConfigFromEnv, verifyFacebookSignature } from '../webhooks/meta-webhook.parser';
import { PortalCareRepository } from './portal-care.repository';
import { parsePortalMetaMessagingPayload } from './portal-meta-webhook.parser';
import { portalMetaWebhookVerifyToken, verifyMetaHubSubscribe } from './portal-inbox-poller.util';

function flattenQuery(query: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) out[key] = String(value[0] ?? '');
    else if (value != null) out[key] = String(value);
  }
  return out;
}

@Injectable()
export class PortalMetaWebhookService {
  private readonly log = new Logger(PortalMetaWebhookService.name);

  constructor(
    private readonly repo: PortalCareRepository,
    private readonly pages: PortalClientPagesRepository,
  ) {}

  async handleGet(req: Request): Promise<{ status: number; body: string; contentType: string }> {
    const query = flattenQuery(req.query as Record<string, unknown>);
    const verify = verifyMetaHubSubscribe(query, portalMetaWebhookVerifyToken());
    if (verify.ok) {
      return { status: 200, body: verify.challenge ?? '', contentType: 'text/plain' };
    }
    if ((query['hub.mode'] ?? query.hub_mode) === 'subscribe') {
      throw new ForbiddenException({ error: 'invalid_verify_token' });
    }
    return { status: 200, body: 'ok', contentType: 'text/plain' };
  }

  /**
   * Lightweight ingest: verify, persist messages/comments/postbacks, enqueue leadgen.
   * Heavy Graph fetches run in the portal-worker process.
   */
  async handlePost(req: Request): Promise<{ status: number; body: Record<string, unknown> }> {
    if (!portalCrmCareEnabled()) {
      return { status: 200, body: { ok: true, skipped: 'module_disabled' } };
    }
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const config = metaConfigFromEnv();
    const sig =
      String(req.headers['x-hub-signature-256'] ?? '') || String(req.headers['x-hub-signature'] ?? '');
    if (config.appSecrets.length && !verifyFacebookSignature(rawBody, sig, config.appSecrets)) {
      throw new UnauthorizedException({ error: 'invalid_signature' });
    }
    const payload =
      typeof req.body === 'object' && req.body && !Buffer.isBuffer(req.body)
        ? (req.body as Record<string, unknown>)
        : (JSON.parse(rawBody.toString('utf8') || '{}') as Record<string, unknown>);
    if (String(payload.object ?? '') !== 'page') {
      return { status: 200, body: { ok: true, ignored: 'not_page_object' } };
    }

    await this.repo.ensure();
    await this.repo.ensureWebhookJobs();
    await this.pages.ensure();
    const { messages, comments, leadHints } = parsePortalMetaMessagingPayload(payload);
    const touchedClients = new Set<string>();
    let commentCount = 0;
    let leadQueued = 0;

    const persisted = await this.persistVerifiedMessages(messages);
    const msgCount = persisted.messages;
    for (const clientId of persisted.clientIds) touchedClients.add(clientId);

    for (const item of comments) {
      const pageId = item.page_id || item.comment.page_id;
      if (!pageId) continue;
      const binding = await this.pages.findByChannelPage('facebook', pageId);
      if (!binding?.active) continue;
      await this.repo.upsertPageComment(binding.client_id, item.comment);
      commentCount += 1;
      touchedClients.add(binding.client_id);
    }

    for (const hint of leadHints) {
      const pageId = hint.page_id;
      if (!pageId || !hint.leadgen_id) continue;
      const binding = await this.pages.findByChannelPage('facebook', pageId);
      if (!binding?.active) continue;
      const queued = await this.repo.enqueueWebhookJob({
        jobType: 'leadgen',
        idempotencyKey: `leadgen:${pageId}:${hint.leadgen_id}`,
        payload: {
          page_id: pageId,
          client_id: binding.client_id,
          leadgen_id: hint.leadgen_id,
          form_id: hint.form_id,
        },
      });
      if (queued) leadQueued += 1;
      touchedClients.add(binding.client_id);
    }

    for (const clientId of touchedClients) {
      await this.repo.syncCases(clientId);
    }

    this.log.log(
      `portal-meta-webhook messages=${msgCount} comments=${commentCount} lead_jobs=${leadQueued} clients=${touchedClients.size}`,
    );
    return {
      status: 200,
      body: { ok: true, messages: msgCount, comments: commentCount, lead_jobs: leadQueued },
    };
  }

  /**
   * Persist Page `messages` and `messaging_postbacks` from a payload whose
   * signature the caller already verified. Does not re-verify, and does not
   * enqueue leadgen or comments — those stay on the original handlers.
   */
  async ingestMessagingFromVerifiedPayload(
    payload: Record<string, unknown>,
  ): Promise<{ messages: number; clients: number }> {
    if (!portalCrmCareEnabled()) return { messages: 0, clients: 0 };
    if (String(payload.object ?? '') !== 'page') return { messages: 0, clients: 0 };
    await this.repo.ensure();
    await this.pages.ensure();
    const { messages } = parsePortalMetaMessagingPayload(payload);
    const persisted = await this.persistVerifiedMessages(messages);
    for (const clientId of persisted.clientIds) {
      await this.repo.syncCases(clientId);
    }
    this.log.log(
      `portal-meta-webhook (via v1) messages=${persisted.messages} clients=${persisted.clients}`,
    );
    return { messages: persisted.messages, clients: persisted.clients };
  }

  private async persistVerifiedMessages(
    messages: Array<{ page_id: string; message: Parameters<PortalCareRepository['upsertPageMessage']>[2] }>,
  ): Promise<{ messages: number; clients: number; clientIds: string[] }> {
    const touchedClients = new Set<string>();
    let msgCount = 0;
    for (const item of messages) {
      const pageId = item.page_id;
      if (!pageId) continue;
      const binding = await this.pages.findByChannelPage('facebook', pageId);
      if (!binding?.active) continue;
      await this.repo.upsertPageMessage(binding.client_id, pageId, item.message);
      msgCount += 1;
      touchedClients.add(binding.client_id);
    }
    return { messages: msgCount, clients: touchedClients.size, clientIds: [...touchedClients] };
  }
}
