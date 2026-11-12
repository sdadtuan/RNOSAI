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
    let msgCount = 0;
    let commentCount = 0;
    let leadQueued = 0;

    for (const item of messages) {
      const pageId = item.page_id;
      if (!pageId) continue;
      const binding = await this.pages.findByChannelPage('facebook', pageId);
      if (!binding?.active) continue;
      const clientId = binding.client_id;
      await this.repo.upsertPageMessage(clientId, pageId, item.message);
      msgCount += 1;
      touchedClients.add(clientId);
    }

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
}
