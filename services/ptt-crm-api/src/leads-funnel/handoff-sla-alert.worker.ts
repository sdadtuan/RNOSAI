import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HandoffSlaAlertService } from './handoff-sla-alert.service';

/** Every 60s so 15-minute accept clocks can still warn 3 minutes before due. */
const TICK_MS = 60_000;

@Injectable()
export class HandoffSlaAlertWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HandoffSlaAlertWorker.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly alerts: HandoffSlaAlertService) {}

  onModuleInit(): void {
    if (process.env.PTT_HANDOFF_SLA_ALERT_WORKER === '0') {
      this.logger.warn('HandoffSlaAlertWorker disabled via env');
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    setTimeout(() => void this.tick(), 25_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.alerts.tick(new Date());
    } catch (err) {
      this.logger.error(`HandoffSlaAlertJob failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.ticking = false;
    }
  }
}
