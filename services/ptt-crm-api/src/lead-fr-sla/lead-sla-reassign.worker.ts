import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LeadSlaReassignService } from './lead-sla-reassign.service';

/** Every 15 minutes; service itself gates on working hours + feature flags. */
const TICK_MS = 15 * 60_000;

@Injectable()
export class LeadSlaReassignWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadSlaReassignWorker.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly reassign: LeadSlaReassignService) {}

  onModuleInit(): void {
    if (process.env.PTT_LEAD_SLA_REASSIGN_WORKER === '0') {
      this.logger.warn('LeadSlaReassignWorker disabled via env');
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    // Deferred first tick so boot stays light
    setTimeout(() => void this.tick(), 20_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.reassign.run(new Date());
    } catch (err) {
      this.logger.error(
        `LeadSlaReassignJob failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
