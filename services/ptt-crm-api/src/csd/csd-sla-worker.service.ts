import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CsdTicketsRepository } from './csd-tickets.repository';
import { tickCsdSla } from './csd-sla.worker';

const TICK_MS = 60_000;

@Injectable()
export class CsdSlaWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CsdSlaWorkerService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly ticketsRepo: CsdTicketsRepository,
  ) {}

  onModuleInit(): void {
    if (process.env.PTT_CSD_SLA_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<{ updated: number; escalated: number }> {
    if (this.ticking) return { updated: 0, escalated: 0 };
    this.ticking = true;
    try {
      const result = await tickCsdSla(new Date(), this.ticketsRepo.getPool());
      if (result.updated || result.escalated) {
        this.logger.debug(`SLA tick updated=${result.updated} escalated=${result.escalated}`);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CSD SLA tick failed: ${message}`);
      return { updated: 0, escalated: 0 };
    } finally {
      this.ticking = false;
    }
  }
}
