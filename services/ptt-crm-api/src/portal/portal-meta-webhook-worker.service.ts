import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MetaBusinessTokenService } from '../agency/meta-business-token.service';
import { fetchFacebookLeadFromGraph, metaConfigFromEnv } from '../webhooks/meta-webhook.parser';
import { isPortalWorkerProcess } from './portal-inbox-poller.util';
import { PortalCareRepository } from './portal-care.repository';
import { graphLeadRowToPulled } from './portal-meta-webhook.parser';

/** Heavy leadgen Graph fetch — portal-worker process only. */
@Injectable()
export class PortalMetaWebhookWorkerService {
  private readonly log = new Logger(PortalMetaWebhookWorkerService.name);
  private busy = false;

  constructor(
    private readonly repo: PortalCareRepository,
    private readonly meta: MetaBusinessTokenService,
  ) {}

  @Interval(4000)
  async tick(): Promise<void> {
    if (!isPortalWorkerProcess()) return;
    if (this.busy) return;
    this.busy = true;
    try {
      await this.drainOnce();
    } catch (err) {
      this.log.warn(`portal webhook worker tick failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.busy = false;
    }
  }

  async drainOnce(limit = 10): Promise<number> {
    await this.repo.ensure();
    await this.repo.ensureWebhookJobs();
    const jobs = await this.repo.claimWebhookJobs(limit);
    if (!jobs.length) return 0;
    const tokens = await this.meta.pageTokens();
    const config = metaConfigFromEnv();
    let done = 0;
    for (const job of jobs) {
      try {
        if (job.job_type === 'leadgen') {
          await this.handleLeadgen(job.payload, tokens, config);
        }
        await this.repo.finishWebhookJob(job.id, 'done');
        done += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.repo.finishWebhookJob(job.id, 'error', message.slice(0, 400));
      }
    }
    return done;
  }

  private async handleLeadgen(
    payload: Record<string, unknown>,
    tokens: Map<string, string>,
    config: ReturnType<typeof metaConfigFromEnv>,
  ): Promise<void> {
    const pageId = String(payload.page_id ?? '').trim();
    const clientId = String(payload.client_id ?? '').trim();
    const leadgenId = String(payload.leadgen_id ?? '').trim();
    if (!pageId || !clientId || !leadgenId) return;
    const token = tokens.get(pageId) ?? '';
    const row = await fetchFacebookLeadFromGraph(leadgenId, { ...config, pageAccessToken: token });
    const pulled = graphLeadRowToPulled(leadgenId, row);
    await this.repo.upsertPageLead(clientId, pageId, pulled);
    await this.repo.syncCases(clientId);
  }
}
