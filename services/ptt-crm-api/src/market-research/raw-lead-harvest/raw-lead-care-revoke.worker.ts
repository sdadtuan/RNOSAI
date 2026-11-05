import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RawLeadHarvestService } from './raw-lead-harvest.service';

const TICK_MS = 60 * 60_000; // hourly

/** Auto-revoke AE care assignments with no contact update after 3 days. */
@Injectable()
export class RawLeadCareRevokeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RawLeadCareRevokeWorker.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly harvest: RawLeadHarvestService) {}

  onModuleInit(): void {
    if (process.env.PTT_RAW_LEAD_CARE_REVOKE_WORKER === '0') {
      this.logger.warn('RawLeadCareRevokeWorker disabled via env');
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    setTimeout(() => void this.tick(), 45_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const out = await this.harvest.runCareRevokeJob(new Date());
      if (out.revoked > 0) {
        this.logger.log(`Revoked ${out.revoked} stale raw-lead care assignments`);
      }
    } catch (err) {
      this.logger.warn(
        `Care revoke tick skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
