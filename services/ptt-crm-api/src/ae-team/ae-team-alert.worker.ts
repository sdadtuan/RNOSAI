import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AeTeamAlertsService } from './ae-team-alerts.service';

const TICK_MS = 60_000;

@Injectable()
export class AeTeamAlertWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AeTeamAlertWorker.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly alerts: AeTeamAlertsService) {}

  onModuleInit(): void {
    if (process.env.PTT_AE_TEAM_ALERT_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    setTimeout(() => void this.tick(), 20_000);
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
      this.logger.error(`AE team alert tick failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.ticking = false;
    }
  }
}
