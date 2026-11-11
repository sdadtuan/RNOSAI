import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PortalMetaInsightsService } from './portal-meta-insights.service';
import {
  InboxPollOverlapLock,
  portalMetaInsightsPollEnabled,
  portalMetaInsightsPollIntervalMs,
} from '../portal/portal-inbox-poller.util';

const POLL_MS = portalMetaInsightsPollIntervalMs();

@Injectable()
export class PortalMetaInsightsPollerService implements OnModuleInit {
  private readonly log = new Logger(PortalMetaInsightsPollerService.name);
  private readonly lock = new InboxPollOverlapLock();

  constructor(private readonly insights: PortalMetaInsightsService) {}

  onModuleInit(): void {
    void this.onInterval();
  }

  @Interval(POLL_MS)
  async onInterval(): Promise<void> {
    if (!portalMetaInsightsPollEnabled()) return;
    if (!this.lock.tryAcquire()) return;
    try {
      const results = await this.insights.syncActiveAccountsIncremental();
      const ok = results.filter((row) => row.ok).length;
      const rows = results.reduce((sum, row) => sum + row.rows, 0);
      this.log.log(
        `portal-meta-insights-poller accounts=${results.length} ok=${ok} rows=${rows}`,
      );
      for (const row of results) {
        this.log.log(
          `portal-meta-insights client=${row.client_id} account=${row.account_id} ok=${row.ok ? 1 : 0} rows=${row.rows}${row.error ? ` error=${row.error}` : ''}`,
        );
      }
    } catch (err) {
      const note = err instanceof Error ? err.message : 'insights_poll_failed';
      this.log.warn(`portal-meta-insights-poller cycle error: ${note}`);
    } finally {
      this.lock.release();
    }
  }
}
