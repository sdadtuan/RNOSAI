import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LeadClaimTimeoutReassignService } from './lead-claim-timeout-reassign.service';
import {
  CLAIM_TIMEOUT_TICK_MS,
  isClaimTimeoutReassignEnabled,
} from './lead-claim-timeout-reassign.util';

/** Every 1 minute; service itself gates on working hours. Defaults ON. */
@Injectable()
export class LeadClaimTimeoutReassignWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadClaimTimeoutReassignWorker.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(private readonly reassign: LeadClaimTimeoutReassignService) {}

  onModuleInit(): void {
    if (!isClaimTimeoutReassignEnabled()) {
      this.logger.warn('LeadClaimTimeoutReassignWorker disabled via PTT_LEAD_CLAIM_TIMEOUT_REASSIGN');
      return;
    }
    this.timer = setInterval(() => void this.tick(), CLAIM_TIMEOUT_TICK_MS);
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
        `ClaimTimeoutReassignJob failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
