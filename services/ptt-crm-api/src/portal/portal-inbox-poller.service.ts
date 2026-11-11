import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { portalCrmCareEnabled } from '../agency/portal-client-pages.util';
import { PortalCareRepository } from './portal-care.repository';
import { PortalInboxSyncService } from './portal-inbox-sync.service';
import {
  InboxPollOverlapLock,
  isFacebookRateOrThrottleError,
  portalInboxPollEnabled,
  portalInboxPollIntervalMs,
} from './portal-inbox-poller.util';

const POLL_MS = portalInboxPollIntervalMs();
const RATE_LIMIT_BACKOFF_MS = 90_000;

@Injectable()
export class PortalInboxPollerService implements OnModuleInit {
  private readonly log = new Logger(PortalInboxPollerService.name);
  private readonly lock = new InboxPollOverlapLock();
  private backoffUntil = 0;

  constructor(
    private readonly repo: PortalCareRepository,
    private readonly inboxSync: PortalInboxSyncService,
  ) {}

  onModuleInit(): void {
    void this.onInterval();
  }

  @Interval(POLL_MS)
  async onInterval(): Promise<void> {
    if (!portalCrmCareEnabled() || !portalInboxPollEnabled()) return;
    if (Date.now() < this.backoffUntil) return;
    if (!this.lock.tryAcquire()) return;
    try {
      await this.runPollCycle();
    } catch (err) {
      const note = err instanceof Error ? err.message : 'poll_failed';
      this.log.warn(`portal-inbox-poller cycle error: ${note}`);
      if (isFacebookRateOrThrottleError(note)) {
        this.backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      }
    } finally {
      this.lock.release();
    }
  }

  private async runPollCycle(): Promise<void> {
    await this.repo.ensure();
    const rows = await this.repo.listActiveFacebookPages();
    if (!rows.length) {
      this.log.debug('portal-inbox-poller pages=0 (no active facebook portal_client_pages)');
      return;
    }
    const byClient = new Map<string, string[]>();
    const pageNamesByClient = new Map<string, string[]>();
    for (const row of rows) {
      const list = byClient.get(row.client_id) ?? [];
      list.push(row.page_id);
      byClient.set(row.client_id, list);
      const names = pageNamesByClient.get(row.client_id) ?? [];
      names.push(row.page_name || row.page_id);
      pageNamesByClient.set(row.client_id, names);
    }
    let hitRateLimit = false;
    for (const [clientId, pageIds] of byClient) {
      const stat = await this.inboxSync.pullFacebookInbox(clientId, { pageIds });
      if (stat.rateLimited) hitRateLimit = true;
      if (stat.hadNew) {
        await this.repo.syncCases(clientId);
      }
      this.log.log(
        `portal-inbox-poller client=${clientId} pageNames=${(pageNamesByClient.get(clientId) ?? []).join(',')} pages=${stat.pages} withToken=${stat.withToken} leads=${stat.leads} messages=${stat.messages}${stat.error ? ' error=1' : ''}`,
      );
    }
    if (hitRateLimit) {
      this.backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    }
  }
}
